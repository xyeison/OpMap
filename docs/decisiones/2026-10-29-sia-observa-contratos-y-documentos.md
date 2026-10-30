# 2026-10-29 – SIA Observa: contratos y documentos de las IPS públicas, con copia de los PDF clave y aprobación humana

**Contexto**: el dueño pidió traer de SIA Observa (Auditoría General) los contratos de las IPS públicas en las líneas, sus
documentos (contrato, estudio previo, anexos, propuesta, adiciones, liquidación), leerlos con Claude y poder importarlos
al módulo de Contratos (`docs/specs/2026-10-29-agente-sia-observa.md`).

**Decisión** (del dueño, en la spec):
- Se guarda copia de los PDF clave en Supabase Storage (bucket privado `contratos-sia`) **y** el enlace de SIA como fuente.
- Nada entra a `hospital_contracts` sin que una persona lo apruebe ("Crear Contrato" en el formulario, o "Aplicar" en
  cada diferencia). Las diferencias con un contrato ya cargado (p. ej. CD/25-1111) se muestran, nunca se sobrescriben solas.
- Sin navegador en producción: todo por HTTP. Playwright solo para el mapeo inicial de entidades, en local.
- SIA se usa como un ciudadano: no se envía el correo de anonimización, no se prueban otros handlers, una petición a la
  vez con 1,5 s de pausa y de noche.
- De personas naturales (médicos contratistas, supervisores, representantes) no se guarda nada.

**Consecuencias**:
- SIA corta las conexiones que no vienen de Colombia (Fase 0, 2026-10-30): la descarga corre en el Mac del dueño
  (`launchd`, 02:00 de Bogotá) y Vercel solo lee de Supabase. "Actualizar desde SIA" pide la relectura a esa corrida.
- La lectura con Claude cuesta dinero (Batch API de noche, a mitad de precio). `scripts/sia-extraer.ts --dry-run` da la
  cifra de páginas antes.
- `check_contracting_model` admite `subasta_inversa` (el formulario ya la ofrecía).

**Dónde vive en el código**: `web/lib/sia-observa/*`, `web/scripts/sia-*.ts`, `web/app/api/sia/**`,
`web/components/contracts/*Sia*`, `/contracts/detectados`; migración `database/migrations/2026-10-30_0920_sia_observa.sql`
(rollback 9957). Pruebas: `web/scripts/sia-observa-check.ts` y `web/scripts/sia-observa-api-check.ts`. Operación:
`docs/fases/fase9-sia-observa.md`.
