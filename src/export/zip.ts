import JSZip from 'jszip'

export async function buildZip(structure: Record<string, string | Uint8Array>) {
  const zip = new JSZip()
  for (const path in structure) {
    zip.file(path, structure[path])
  }
  return zip.generateAsync({ type: 'uint8array' })
}
