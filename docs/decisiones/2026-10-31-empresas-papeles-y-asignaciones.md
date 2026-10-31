# 2026-10-31 – Empresas como dato, papeles por persona y empresa, y líneas por persona, Zona y línea

**Contexto**: el dueño, mirando la página de Ejecutivos Comerciales en el celular, preguntó si todos los usuarios salen
de una misma tabla y pidió "la mejor estructura posible" porque "a futuro debe vincularse con Odoo". Recordó que "cada
usuario puede estar asociado a más de una empresa o a una" (Lizeth y Katherine son de Medix), que debe saberse "si está
logeado en el momento como VG o está como Medix", y que "uno puede estar asociado a múltiples zonas y dependiendo de la
zona distintas unidades" ("en la zona A tiene la línea X y en la B tiene la línea X y J"). Aclaró que "Lizeth puede ser
líder en una empresa y ejecutiva en otra" y que Paola "puede ser ejecutiva comercial en sustitutos óseos pero líder en
trauma"; que "la línea A puede estar para la empresa X y Z pero la línea B solo en la empresa X"; que las Zonas y los
médicos son compartidos ("para beneficiarnos de una sola base") y las visitas "son las visitas de cada empresa".
Spec: `docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md`.

**Decisión**:
1. **Empresas** son un dato (`empresas`: VG Medical y Medix hoy). Cada empresa tiene su propio Odoo; los enlaces a Odoo
   (`odoo_enlaces`) son por empresa. OpMap manda hoy; Odoo se va conectando pieza por pieza, sin sincronizar todavía.
2. **Una persona, un ingreso, varios papeles**: lo que puede hacer sale de `papeles` (persona · empresa · papel ·
   línea si es líder). Al entrar está "como" una empresa (por persona, guardada en la base, cambiable desde el menú y
   desde Ajustes de la app) y vale la suma de sus papeles en esa empresa. Los nombres de los papeles son los roles de
   hoy. El Administrador edita papeles de cualquier empresa.
3. **Líder por línea y empresa**: uno nacional, o varios si cada uno tiene Zonas y no se solapan ("dos líderes de una
   misma línea solo dividiendo por zonas"). Preparado desde la primera migración; sin pantalla especial.
4. **Las líneas son por empresa** (`linea_empresas`, muchos a muchos). Las Zonas, los tiempos de carretera, los médicos,
   cuentas, sedes, contactos e IPS son compartidos. Las visitas y las citas son de la empresa activa al capturarlas (la
   app sin señal guarda la empresa con cada visita).
5. **Las líneas se llevan por Zona** (`asignaciones`: persona · Zona · línea · empresa). La zona base pasa a ser solo
   la Zona de residencia. La cobertura sale de las asignaciones: local donde la tiene, alcance por carretera desde cada
   Zona asignada. "Líneas permitidas" desaparece.
6. **Perder una línea en una Zona no cierra visitantes**: "ella en Cúcuta no podría ni programar ni visitar marcando esa
   línea y listo". Reportar y Agendar ofrecen la línea solo si hay asignación en la Zona del municipio de la sede o del
   médico. Los visitantes se cierran al perder la línea en todas sus Zonas de la empresa, o con la baja. Quitar el papel
   de Ejecutivo Comercial en una empresa borra sus asignaciones en esa empresa (con aviso de cuántas Zonas y visitantes).
7. **La visita se pinta en la Zona donde se hizo**: la Zona asignada de la persona cuyo territorio contiene el municipio
   de la visita; si ninguna, su Zona de residencia. Reemplaza, en eso, "la Zona de la visita sigue a la de la persona"
   de `2026-10-29-visitas-vmo-mapa-de-calor.md`.
8. **Por capas, con compatibilidad** (enfoque elegido por el dueño): cuatro PRs; las columnas viejas (`users.role`,
   `business_lines.leader_user_id`, `executive_lines`, `executives.company`) siguen como caché derivada hasta la capa 4.

**Consecuencias**: migraciones 0960 (capa 1), 0970 (capa 2), 0980 (capa 3) y una de limpieza (capa 4), cada una solo
con autorización del dueño y en la ventana de su despliegue; costo Google 0; la estética del mapa no cambia (el mapa
por línea filtra por empresa). Nadie ve nada distinto mientras tenga una sola empresa y un solo papel. Descartado: una
base por empresa, y que una empresa vea las visitas de otra al mismo médico. Pendientes, con spec propia: la marca por
empresa (logo, colores, ícono) y la página de Ejecutivos Comerciales al estilo de la app.

**Dónde vive en el código**: `web/lib/empresas.ts`, `web/lib/permissions.ts` (`permisosDePapeles`, `papelMasAlto`),
`web/lib/auth-server.ts` (`SessionUser.empresa/papeles/permisos`), `web/lib/session.ts` (claim `emp`),
`web/app/api/auth/empresa`, `/users`; después `web/lib/coverage.ts` y `web/lib/persona-campo.ts`. Pruebas:
`web/scripts/empresas-check.ts` y `empresas-api-check.ts` (capa 1) y las de cobertura, zonas y persona de campo.
