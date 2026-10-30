// Background Sync de la cola de visitas de VG Visitas (app sin señal, dueño 2026-10-30). Lo importa el service worker
// que genera Workbox (web/scripts/construir-campo.mjs, importScripts). Corre SOLO donde existe Background Sync (Chrome
// en Android): cuando la app pide `sync.register('opmap-cola')` (mobile/lib/pwa.ts) y vuelve la señal, el navegador
// dispara el evento `sync` aunque la página esté cerrada, y aquí se sube lo pendiente.
//
// Lee de IndexedDB (base opmap-campo, mobile/lib/almacen-idb.ts) el token (kv opmap.token.v1) y la cola de cada usuario
// (kv opmap.cola.v2.<uid del token>, el mismo JSON de mobile/lib/cola.ts; nunca la de otro usuario) y hace lo mismo que la app: POST /api/me/visitas
// por visita (idempotente por client_id: el servidor nunca duplica), marca enviada con el 201 y, después, sube la foto
// de la visita (almacén fotos, POST /api/me/visitas/foto). Un 401 detiene todo sin tocar nada (la app pedirá entrar).
// Si la página está abierta a la vez, las dos pueden intentar la misma visita: el servidor responde `repetida` y la
// cola queda igual. Cada cambio de estado se escribe sobre UNA visita en su propia transacción (actualizarElemento), nunca
// la cola entera: lo que la página agregue mientras tanto no se pierde. Nunca se borra nada aquí.
/* global self, indexedDB */
;(function () {
  var NOMBRE_BD = 'opmap-campo'
  var ALMACEN_KV = 'kv'
  var ALMACEN_FOTOS = 'fotos'
  var CLAVE_TOKEN = 'opmap.token.v1'
  var PREFIJO_COLA = 'opmap.cola.v2.'
  var ETIQUETA = 'opmap-cola'
  var TIEMPO_MS = 20000

  function abrir() {
    return new Promise(function (resolve, reject) {
      // Sin versión: la que exista (la app la crea y la migra; el worker nunca cambia el esquema).
      var pedido = indexedDB.open(NOMBRE_BD)
      pedido.onsuccess = function () {
        resolve(pedido.result)
      }
      pedido.onerror = function () {
        reject(pedido.error)
      }
    })
  }
  function pedir(peticion) {
    return new Promise(function (resolve, reject) {
      peticion.onsuccess = function () {
        resolve(peticion.result)
      }
      peticion.onerror = function () {
        reject(peticion.error)
      }
    })
  }
  function leerKv(db, clave) {
    return pedir(db.transaction(ALMACEN_KV, 'readonly').objectStore(ALMACEN_KV).get(clave)).then(function (fila) {
      return fila ? fila.valor : null
    })
  }
  /**
   * Cambia UNA visita de la cola, leyendo y escribiendo en la MISMA transacción: la página pudo agregar o cambiar otras
   * mientras se subía esta, y volver a escribir una copia vieja de la cola entera las borraría. Nunca quita elementos.
   */
  function actualizarElemento(db, clave, clientId, cambios) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(ALMACEN_KV, 'readwrite')
      var almacen = tx.objectStore(ALMACEN_KV)
      var lectura = almacen.get(clave)
      var cambiado = false
      lectura.onsuccess = function () {
        var fila = lectura.result
        var guardado = null
        try {
          guardado = fila && fila.valor ? JSON.parse(fila.valor) : null
        } catch (e) {
          guardado = null
        }
        if (!guardado || !Array.isArray(guardado.items)) return
        guardado.items = guardado.items.map(function (e) {
          if (!e || e.client_id !== clientId) return e
          cambiado = true
          return Object.assign({}, e, cambios)
        })
        if (cambiado) almacen.put({ clave: clave, valor: JSON.stringify(guardado), guardado_at: new Date().toISOString() })
      }
      lectura.onerror = function () {
        reject(lectura.error)
      }
      tx.oncomplete = function () {
        resolve(cambiado)
      }
      tx.onerror = function () {
        reject(tx.error)
      }
      tx.onabort = function () {
        reject(tx.error)
      }
    })
  }
  /** El usuario del token (su carga va en base64url antes del punto): solo se sube SU cola, nunca la de otro usuario del teléfono. */
  function uidDelToken(token) {
    try {
      var parte = String(token).split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
      while (parte.length % 4) parte += '='
      var texto = decodeURIComponent(
        Array.prototype.map
          .call(atob(parte), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          })
          .join('')
      )
      var datos = JSON.parse(texto)
      return typeof datos.uid === 'string' && datos.uid ? datos.uid : null
    } catch (e) {
      return null
    }
  }
  function leerFoto(db, clientId) {
    if (!db.objectStoreNames.contains(ALMACEN_FOTOS)) return Promise.resolve(null)
    return pedir(db.transaction(ALMACEN_FOTOS, 'readonly').objectStore(ALMACEN_FOTOS).get(clientId))
  }
  function guardarFoto(db, registro) {
    return pedir(db.transaction(ALMACEN_FOTOS, 'readwrite').objectStore(ALMACEN_FOTOS).put(registro))
  }

  function conTiempo(promesa, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () {
        reject(new TypeError('tiempo agotado'))
      }, ms)
      promesa.then(
        function (v) {
          clearTimeout(t)
          resolve(v)
        },
        function (e) {
          clearTimeout(t)
          reject(e)
        }
      )
    })
  }

  /** ¿Se reintenta más tarde? Sin red, 5xx, 404 (ruta aún no publicada), 429. 401 detiene. 400/403/409/422: datos. */
  function reintentable(status) {
    return status === 0 || status >= 500 || status === 404 || status === 429
  }
  function espera(intentos) {
    var n = Math.max(1, intentos)
    return Math.min(60000 * Math.pow(2, n - 1), 15 * 60000)
  }

  function enviarVisita(token, cuerpo) {
    return conTiempo(
      fetch('/api/me/visitas', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(cuerpo),
      }),
      TIEMPO_MS
    )
  }
  function enviarFoto(token, clientId, blob) {
    var formulario = new FormData()
    formulario.append('client_id', clientId)
    formulario.append('foto', blob, 'foto.jpg')
    return conTiempo(fetch('/api/me/visitas/foto', { method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }, body: formulario }), 60000)
  }

  /** Sube las pendientes de UNA cola (un usuario). Devuelve 'sesion' si hubo 401, 'red' si se cortó, null si terminó. */
  function subirCola(db, token, clave) {
    return leerKv(db, clave).then(function (texto) {
      if (!texto) return null
      var guardado
      try {
        guardado = JSON.parse(texto)
      } catch (e) {
        return null
      }
      if (!guardado || guardado.version !== 2 || !Array.isArray(guardado.items)) return null
      var items = guardado.items
      var ahora = Date.now()
      var pendientes = items
        .filter(function (e) {
          return e && (e.estado === 'pendiente' || e.estado === 'enviando') && e.cuerpo
        })
        .filter(function (e) {
          return !e.proximo_intento_at || Date.parse(e.proximo_intento_at) <= ahora
        })
        .sort(function (a, b) {
          return String(a.creado_at).localeCompare(String(b.creado_at))
        })
      var paso = function (i) {
        if (i >= pendientes.length) return Promise.resolve(null)
        var e = pendientes[i]
        return enviarVisita(token, e.cuerpo)
          .then(
            function (r) {
              return r.text().then(function (t) {
                var datos = null
                try {
                  datos = t ? JSON.parse(t) : null
                } catch (err) {
                  datos = null
                }
                return { status: r.status, datos: datos }
              })
            },
            function () {
              return { status: 0, datos: null }
            }
          )
          .then(function (r) {
            var ahoraIso = new Date().toISOString()
            var intentos = (e.intentos || 0) + 1
            var cambios = { intentos: intentos, ultimo_intento_at: ahoraIso }
            var guardar = function () {
              return actualizarElemento(db, clave, e.client_id, cambios)
            }
            if (r.status === 201 && r.datos && r.datos.visita) {
              Object.assign(cambios, { estado: 'enviada', visita_id: r.datos.visita.id, repetida: !!r.datos.repetida, enviada_at: ahoraIso, proximo_intento_at: null, error: null })
              return guardar().then(function () {
                return subirFotoDe(db, token, e).then(function () {
                  return paso(i + 1)
                })
              })
            }
            if (r.status === 401) {
              cambios.error = 'Tu sesión venció. Vuelve a entrar.'
              return guardar().then(function () {
                return 'sesion'
              })
            }
            if (reintentable(r.status)) {
              Object.assign(cambios, {
                estado: 'pendiente',
                proximo_intento_at: new Date(Date.now() + espera(intentos)).toISOString(),
                error: r.status === 0 ? 'Sin conexión con el servidor.' : 'El servidor no respondió bien (' + r.status + ').',
              })
              return guardar().then(function () {
                return 'red'
              })
            }
            Object.assign(cambios, { estado: 'no_enviada', error: (r.datos && r.datos.error) || 'El servidor no aceptó la visita.' })
            return guardar().then(function () {
              return paso(i + 1)
            })
          })
      }
      return paso(0)
    })
  }

  function subirFotoDe(db, token, e) {
    if (!e.con_foto) return Promise.resolve()
    return leerFoto(db, e.client_id)
      .then(function (foto) {
        if (!foto || foto.estado === 'enviada' || !foto.blob) return
        return enviarFoto(token, e.client_id, foto.blob).then(
          function (r) {
            var ahoraIso = new Date().toISOString()
            foto.intentos = (foto.intentos || 0) + 1
            foto.ultimo_intento_at = ahoraIso
            if (r.ok) {
              foto.estado = 'enviada'
              foto.enviada_at = ahoraIso
              foto.blob = null
              foto.error = null
            } else if (r.status === 401 || reintentable(r.status)) {
              foto.estado = 'pendiente'
              foto.proximo_intento_at = new Date(Date.now() + espera(foto.intentos)).toISOString()
            } else {
              foto.estado = 'no_enviada'
              foto.error = 'El servidor no aceptó la foto (' + r.status + ').'
            }
            return guardarFoto(db, foto)
          },
          function () {
            foto.intentos = (foto.intentos || 0) + 1
            foto.proximo_intento_at = new Date(Date.now() + espera(foto.intentos)).toISOString()
            return guardarFoto(db, foto)
          }
        )
      })
      .catch(function () {})
  }

  function subirTodo() {
    return abrir().then(function (db) {
      return leerKv(db, CLAVE_TOKEN).then(function (token) {
        var uid = token ? uidDelToken(token) : null
        if (!token || !uid) return
        // Solo la cola de quien tiene la sesión: en un teléfono compartido, la de otra persona espera a que ella entre.
        return subirCola(db, token, PREFIJO_COLA + uid)
      })
    })
  }

  self.addEventListener('sync', function (evento) {
    if (evento.tag !== ETIQUETA) return
    evento.waitUntil(subirTodo().catch(function () {}))
  })
})()
