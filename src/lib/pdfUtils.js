import * as pdfjsLib from 'pdfjs-dist'

// Use CDN worker — avoids Vite worker-bundling complexity
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export async function pdfToJpegs(pdfFile, { scale = 2.5, quality = 0.92, maxPages = 10 } = {}) {
  const buffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const total = Math.min(pdf.numPages, maxPages)
  const baseName = pdfFile.name.replace(/\.pdf$/i, '')
  const results = []

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    results.push({ blob, pageNum: i, fileName: `${baseName}_page-${i}.jpg` })
  }
  return results
}

export async function pdfFirstPageToJpeg(pdfFile) {
  const pages = await pdfToJpegs(pdfFile, { scale: 2.5, maxPages: 1 })
  return pages[0] ?? null
}
