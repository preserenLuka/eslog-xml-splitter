export type OutputCategory = 'water' | 'waste' | 'report'

const outputFolderByType: Record<OutputCategory, string> = {
  water: 'voda',
  waste: 'odpadki',
  report: 'porocila'
}

const filenameSuffixByType: Partial<Record<OutputCategory, string>> = {
  water: 'voda',
  waste: 'odpadki'
}

export function buildOutputFilename(sourceFilename: string, type: OutputCategory) {
  const baseName = sourceFilename.replace(/\.xml$/i, '')
  const suffix = filenameSuffixByType[type]
  return suffix ? `${baseName}_${suffix}.xml` : sourceFilename
}

export function buildZipPath(type: OutputCategory, filename: string) {
  return `${outputFolderByType[type]}/${filename}`
}

export function buildDuplicateFilename(filename: string, suffix: number) {
  const match = filename.match(/^(.*?)(\.[^.]*)?$/)
  const baseName = match?.[1] || filename
  const extension = match?.[2] || ''
  return `${baseName}_${String(suffix).padStart(2, '0')}${extension}`
}

export const processingReportPath = 'porocila/seznam.json'
export const processingCsvPath = 'porocila/seznam.csv'
