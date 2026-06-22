export function csvEscape(v: string | number | null | undefined) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function buildProcessingReport(rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] || {})
  const lines = [headers.join(',')]
  rows.forEach((r) => {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  })
  return lines.join('\n')
}
