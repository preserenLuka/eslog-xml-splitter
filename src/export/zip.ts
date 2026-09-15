import JSZip from 'jszip'

export async function buildZip(structure: Record<string, string | Uint8Array>): Promise<Blob> {
  const zip = new JSZip()
  for (const path in structure) zip.file(path, structure[path])
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(content: string, filename: string, mime = 'application/xml'): void {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename)
}
