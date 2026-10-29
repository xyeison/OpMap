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
2. Solo se importan las visitas efectivas ("Visita realizada") con un punto en Colombia. De cada una se guarda la
   fecha, el punto, presencial o virtual y la persona. Nada más del archivo sale del navegador: ni médicos, ni cédulas,
   ni teléfonos, ni comentarios, ni productos.
3. Llaves con VMO:
   - Visita: `visits.vmo_id`, el ID de VMO, único. Importar otra vez el mismo período actualiza y no duplica.
   - Persona: `executives.vmo_nombre`, el nombre como lo escribe VMO, normalizado. La exportación no trae otro dato
     de la persona. La primera vez se busca a la persona de OpMap por el nombre sin tildes o "parecido" (VMO a veces
     omite el segundo nombre), sin vacantes y sin adivinar si hay dos candidatas. Si no existe, se crea:
     - activa, si visitó en los últimos 60 días; si no, inactiva;
     - sin Zona (se le asigna en Ejecutivos Comerciales);
     - con la nota "Creada al importar visitas de VMO".
4. Cada visita queda con la Zona de su persona (`kam_id = base_kam_id`), así funciona el filtro por Zona del mapa.
   No se calcula IPS: el mapa de calor no la necesita.
5. Se borra lo viejo: las 7.033 visitas de 2025 y el registro mensual (`visit_imports`), con respaldo. Las visitas de
   la app no se tocan.
6. Quien no tiene `visits:view` (Ejecutivos Comerciales) ve las de VMO con el nombre de la Zona, no el de la persona,
   igual que antes.

**Consecuencias**:
- `/visits` pasa a ser solo "subir el Excel de VMO": resumen por mes y por persona, importar por lotes de 1.000 y
  resultado (personas reconocidas y creadas). Se quitan la plantilla, el mes y año a mano y el historial de
  importaciones. Permiso `visits:manage`.
- El selector de año de las visitas del mapa llega hasta el año en curso y arranca en el mes en curso.
- `/visits/coverage` (fuera del menú) deja de contar las visitas de VMO, porque ya no traen IPS.
- Migración 0910, con rollback 9956.

**Dónde vive**: `web/lib/vmo-visitas.ts` (lectura, llaves y validación), `web/app/api/visits/_lib/importar-vmo.ts`
(`POST /api/visits/import`), `web/app/visits/page.tsx`, pruebas en `web/scripts/vmo-visitas-check.ts`.
