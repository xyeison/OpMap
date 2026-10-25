# 2026-10-25 – Los procesos de SECOP II sin contrato se muestran como radar comercial, aparte de las compras

**Contexto**: el dueño notó que un contrato de VG Medical con el Hospital Universitario del Caribe no salía en el mapa, y
que Montería salía "sin nada". La investigación del 2026-10-25 encontró la causa:

- 83 de las 141 IPS públicas publican sus compras en SECOP II solo como procesos de "Contratación régimen especial"
  (dataset `p6dx-8zbt`) y nunca crean el contrato electrónico. OpMap solo carga contratos.
- La carga no estaba rota: donde hay contratos electrónicos, la base está completa (57 de 61 en una muestra).
- El caso de VG Medical es el proceso CO1.REQ.10254526 (000039-2026), con precio base de 1.760 M, `adjudicado = No`.
- Montería: la ESE San Jerónimo publicó 1.228 procesos en 12 meses y ningún contrato.

Con las palabras del dueño: "Sí, entonces busquemos la forma de presentarlos […] para cualquiera tener el radar a VG
Medical para el Hospital Universitario del Caribe sería muy bueno. Y si esa otra empresa no tiene esta fuente de
información, pues no sabrán ni que existimos. Entonces, por lo menos le das herramienta al comercial para que se pregunte
quién es VG Medical. ¿Será que sí es verdad que tiene ese contrato?".

**Decisión** (spec `docs/specs/2026-10-25-secop-procesos-radar.md`):
1. **Se carga una cuarta fuente de SECOP**: los procesos de `p6dx-8zbt`, solo de las IPS públicas objetivo y solo los de
   material ortopédico o de neurocirugía. Van en una tabla aparte, `secop_procesos`, que no tiene columna de valor.
2. **Se muestran aparte y nunca se suman.** La sección "Procesos publicados sin contrato (SECOP II)" va en las tarjetas del
   mapa (12 meses) y en la ficha de la IPS (24 meses), con el precio base de cada proceso, el proveedor que figura y un
   enlace al expediente.
   - No entran en las compras, el ranking, `/inteligencia` ni los totales.
   - Un proceso que ya tiene contrato cargado no se repite: está en "Compras".
3. **Los Ejecutivos Comerciales sí los ven**, con el permiso nuevo `secop:procesos`. Siguen sin ver las compras de SECOP y
   `/inteligencia`, que mantienen `intelligence:view` (decisión del 2026-10-24).
4. **Textos honestos**: "proveedor que figura", nunca "adjudicado a" ni "ganó"; "precio base de la convocatoria; la entidad
   no registró el contrato en SECOP: confirmar con la entidad". Sin procesos, la sección no aparece.
5. **Privacidad**:
   - las personas naturales no se nombran;
   - los datos de pacientes en las descripciones se redactan antes de guardarlos;
   - el título del proceso no se muestra tal cual.
6. **Corrige la spec del 2026-10-12**:
   - en régimen especial, "Publicado" no es una licitación abierta: no hay recepción de ofertas;
   - la pestaña "Licitaciones" de `/inteligencia` queda para después.

**Consecuencias**:
- Hacen falta la migración 0890 con su rollback, una carga inicial (sin costo de Google) y un cron diario `secop_procesos`.
- Todo eso se aplica solo con autorización del dueño, en la ventana del despliegue.
- Los detalles de "Para decidir" de la spec se construyen con la recomendación y el dueño puede cambiarlos.
