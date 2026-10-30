// SIA Observa · páginas de un PDF y si tiene texto (los escaneados no tienen: los lee Claude como imagen). Solo scripts y
// servidor. Mismo pdf.js (legacy build, worker en el mismo hilo) que lib/reps-pdf.ts.

export interface InfoPdf {
  paginas: number | null
  tieneTexto: boolean | null
}

/** Caracteres de texto que debe tener un PDF para no contarlo como escaneado (encabezados sueltos no cuentan). */
export const MIN_CARACTERES_TEXTO = 200

export async function analizarPdf(bytes: Uint8Array, maxPaginasTexto = 5): Promise<InfoPdf> {
  try {
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise
    try {
      let caracteres = 0
      for (let n = 1; n <= Math.min(doc.numPages, maxPaginasTexto) && caracteres < MIN_CARACTERES_TEXTO; n++) {
        const page = await doc.getPage(n)
        const content = await page.getTextContent()
        for (const item of content.items as Array<{ str?: string }>) caracteres += (item.str ?? '').replace(/\s+/g, '').length
      }
      return { paginas: doc.numPages, tieneTexto: caracteres >= MIN_CARACTERES_TEXTO }
    } finally {
      await doc.destroy()
    }
  } catch {
    // PDF dañado o con contraseña: se guarda igual (es la copia del portal), sin páginas ni texto
    return { paginas: null, tieneTexto: null }
  }
}
