// pdfjs-dist no publica tipos para el worker. Importarlo registra globalThis.pdfjsWorker, que
// pdf.js usa como "worker falso" en Node (lib/reps-pdf.ts): así no hace falta un archivo aparte.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
