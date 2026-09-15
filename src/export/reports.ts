export function csvEscape(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  const safe = /^[=+\-@\t]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export function buildProcessingReport(rows: Record<string, unknown>[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const lines = [headers.map(csvEscape).join(';')]
  for (const row of rows) lines.push(headers.map((header) => csvEscape(row[header] as string | number | boolean | null | undefined)).join(';'))
  return `\uFEFF${lines.join('\r\n')}`
}

export function buildJsonReport(metadata: Record<string, unknown>, inputs: Record<string, unknown>[]) {
  return JSON.stringify({ ...metadata, inputs }, null, 2)
}
