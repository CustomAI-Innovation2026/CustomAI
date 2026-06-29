import * as mupdf from 'mupdf'

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } },
}

const MAX_PAGES = 30
const DPI = 200

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fileUrl } = req.body || {}
  if (!fileUrl) {
    return res.status(400).json({ error: 'Missing fileUrl' })
  }

  try {
    const pdfResp = await fetch(fileUrl)
    if (!pdfResp.ok) {
      return res.status(400).json({ error: `Failed to download file: ${pdfResp.status}` })
    }
    const arrayBuffer = await pdfResp.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const doc = mupdf.Document.openDocument(buffer, 'application/pdf')
    const totalPages = doc.countPages()
    if (totalPages > MAX_PAGES) {
      return res.status(400).json({ error: `PDF has ${totalPages} pages, exceeds limit of ${MAX_PAGES}` })
    }

    const zoom = DPI / 72
    const matrix = mupdf.Matrix.scale(zoom, zoom)
    const pages = []

    for (let i = 0; i < totalPages; i++) {
      const page = doc.loadPage(i)
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
      const pngBuffer = pixmap.asPNG()
      const base64 = Buffer.from(pngBuffer).toString('base64')
      pages.push({
        page: i + 1,
        totalPages,
        dataUrl: `data:image/png;base64,${base64}`,
      })
      pixmap.destroy()
      page.destroy()
    }
    doc.destroy()

    return res.status(200).json({ totalPages, pages })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'PDF conversion failed' })
  }
}
