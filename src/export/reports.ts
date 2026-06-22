export function csvEscape(v: string | number | null | undefined) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // Prefix formula-starting chars to prevent spreadsheet injection (OWASP)
  const safe = /^[=+\-@\t]/.test(s) ? `'${s}` : s
  if (safe.includes(',') || safe.includes('\n') || safe.includes('"')) return '"' + safe.replace(/"/g, '""') + '"'
  return safe
}

export function buildProcessingReport(rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] || {})
  const lines = [headers.join(',')]
  rows.forEach((r) => {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  })
  return lines.join('\n')
}
