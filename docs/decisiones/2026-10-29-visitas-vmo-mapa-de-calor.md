# 2026-10-29 – Visitas de VMO al mapa de calor: solo efectivas, por Ejecutivo Comercial y con llave de VMO

**Contexto**: el importador de VMO se apagó el 2026-10-12 ("VMO morirá", `2026-10-12-app-de-visita.md`). Lo último en
OpMap era octubre de 2025: 7.033 visitas con el día al azar (el importador no leía la fecha), a nombre de la Zona y con
la IPS adivinada a 5 km. El equipo sigue reportando en VMO 2026. El dueño pidió una solución transitoria para el mapa de
calor: "No necesitamos más data en OpMap, que es una herramienta exploratoria de diseño, pero que la vamos a comenzar a
usar en producción para evaluar cómo se comportan". Y luego: "Yo solo requiero que se guarde las visitas
georeferenciadas por comercial y si ya no existe igual crear la persona. Ver qué dato podemos guardar aquí en OpMap con
un dato que haya en VMO para hacer una llave y poder importar solo las visitas efectivas y ya. Hazlo, si tienes que
recrear todo desde 0 pues hazlo. Borrar lo viejo pues hazlo. Simplifica. Ejecuta."

**Decisión**:
1. Fuente: VMO › Visitas ("General | Visitas"), Excel → Todo, del rango de fechas que se quiera. Es la exportación
   georreferenciada: cada fila trae ID, fecha y hora reales, latitud, longitud y el Ejecutivo Comercial
   ("Representante").
2. Solo se importan las visitas hechas con un punto en Colombia. Son "Visita realizada" y "Visita extra"; la extra es
   la que VMO deja registrar con el ciclo completo, va como "Visita extra" y en toda la historia hay 16. De cada una se
   guarda la fecha, el punto, presencial o virtual y la persona. Nada más del archivo sale del navegador: ni médicos, ni
   cédulas, ni teléfonos, ni comentarios, ni productos.
3. Llaves con VMO:
   - Visita: `visits.vmo_id`, el ID de VMO, único. Importar otra vez el mismo período actualiza y no duplica.
   - Persona: `executives.vmo_nombre`, el nombre como lo escribe VMO, normalizado. La exportación no trae otro dato
     de la persona. La primera vez se busca a la persona de OpMap por el nombre sin tildes o "parecido" (VMO a veces
     omite el segundo nombre), sin vacantes y sin adivinar si hay dos candidatas. Todos los nombres del archivo se
     emparejan juntos, así que el resultado no depende del orden. Antes de importar, la página dice a quién reconoce y
     a quién crea. Si no existe, se crea:
     - activa, si visitó en los últimos 60 días; si no, inactiva;
     - sin Zona (se le asigna en Ejecutivos Comerciales);
     - con la nota "Creada al importar visitas de VMO".
4. Cada visita queda con la Zona de su persona (`kam_id = base_kam_id`), así funciona el filtro por Zona del mapa. Si
   la Zona de la persona cambia en Ejecutivos Comerciales, sus visitas de VMO la siguen. No se calcula IPS: el mapa de
   calor no la necesita.
5. Se borra lo viejo: las 7.033 visitas de 2025 y el registro mensual (`visit_imports`), con respaldo. Las visitas de
   la app no se tocan.
6. Quien no tiene `visits:view` ve solo sus propias visitas de VMO. Ahora traen persona, GPS y fecha real, y entre
   Ejecutivos Comerciales no se ven, igual que en la app (spec de la app de visita, sección 11). Un visor sin persona no
   ve ninguna. Antes veían el histórico de todos porque era por Zona y con fecha al azar. Si el dueño quiere abrirlo,
   es un cambio de una línea en `/api/visits/filtered`.
7. Las 7 personas creadas en la carga inicial quedaron con Zona. Las 4 activas tienen la ciudad que les da VMO y las 3
   inactivas, la de la mediana de sus visitas: Katherinne en Montería; Lizeth y Sindy en Valledupar; María Alejandra
   Cobo en Cali; Camila y Mayerith en Bogotá Norte; Sthefania en Barranquilla.

**Consecuencias**:
- `/visits` pasa a ser solo "subir el Excel de VMO": resumen por mes y por persona, importar por lotes de 1.000 y
  resultado (personas reconocidas y creadas). Se quitan la plantilla, el mes y año a mano y el historial de
  importaciones. Permiso `visits:manage`.
- El selector de año de las visitas del mapa llega hasta el año en curso y arranca en el mes en curso.
- Como las visitas de VMO no traen IPS, "Datos de la zona" ya no muestra "IPS visitadas" cuando la cifra es 0.
  `/visits/coverage` (fuera del menú) sigue marcando IPS visitadas por cercanía (5 km).
- La carga inicial va en un solo archivo hasta hoy: si una persona nueva se crea inactiva, una importación posterior
  no la reactiva.
- Migración 0910, con rollback 9956. El rollback no borra a las personas creadas, porque pueden tener ya Zona, líneas
  o usuario; las lista.

**Dónde vive**: `web/lib/vmo-visitas.ts` (lectura, llaves y validación), `web/app/api/visits/_lib/importar-vmo.ts`
(`POST /api/visits/import`), `web/app/visits/page.tsx`, pruebas en `web/scripts/vmo-visitas-check.ts`.
