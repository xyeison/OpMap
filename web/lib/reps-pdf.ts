// Fase 3 · Lectura de PDF CON TEXTO (no escaneado) para el importador del REPS. Solo servidor.
// pdf.js (legacy build, Node) extrae el texto de cada página con su posición; la tabla se
// reconstruye en lib/reps-import.ts (pdfPagesToTable: filas por Y, columnas por X).
// Un PDF escaneado (imágenes) no tiene texto: se devuelve "PDF sin texto (escaneado): requiere OCR".
//
// next.config.js deja 'pdfjs-dist' fuera del bundle (serverComponentsExternalPackages) y el worker
// se importa en el mismo hilo (globalThis.pdfjsWorker), sin archivos aparte ni red.

import { PDF_NO_TEXT_ERROR, RepsImportError, pdfPagesToTable, type PdfPageItems, type RawTable } from './reps-import'

export const REPS_MAX_PDF_PAGES = 400

interface PdfJsTextItem {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}

/** Texto con posición de cada página del PDF. */
export async function extractPdfPages(bytes: Uint8Array): Promise<PdfPageItems[]> {
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // pdf.js puede transferir (vaciar) el buffer: se le pasa una copia
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  })

  let doc: Awaited<typeof loadingTask.promise>
  try {
    doc = await loadingTask.promise
  } catch (error) {
    const name = (error as { name?: string })?.name
    if (name === 'PasswordException') throw new RepsImportError('El PDF está protegido con contraseña')
    throw new RepsImportError('No se pudo leer el PDF (¿está dañado?)')
  }

  try {
    if (doc.numPages > REPS_MAX_PDF_PAGES) {
      throw new RepsImportError(`El PDF tiene ${doc.numPages} páginas (máximo ${REPS_MAX_PDF_PAGES}): divídelo`)
    }
    const pages: PdfPageItems[] = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = (content.items as PdfJsTextItem[])
        .filter(item => typeof item.str === 'string' && Array.isArray(item.transform))
        .map(item => {
          const transform = item.transform as number[]
          return {
            str: item.str as string,
            x: transform[4],
            y: transform[5],
            width: typeof item.width === 'number' ? item.width : 0,
            height: typeof item.height === 'number' && item.height > 0 ? item.height : Math.abs(transform[3]) || 10,
          }
        })
      pages.push({ pageNumber, items })
      page.cleanup()
    }
    return pages
  } finally {
    await doc.destroy()
  }
}

/** PDF → tabla cruda (o RepsImportError con PDF_NO_TEXT_ERROR si no hay texto). */
export async function parsePdfToTable(bytes: Uint8Array): Promise<{ table: RawTable; headerDetected: boolean; warnings: string[] }> {
  const pages = await extractPdfPages(bytes)
  const textItems = pages.reduce((sum, page) => sum + page.items.filter(item => item.str.trim() !== '').length, 0)
  if (textItems === 0) throw new RepsImportError(PDF_NO_TEXT_ERROR)
  return pdfPagesToTable(pages)
}
