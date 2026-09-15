/**
 * Removes tariff details that Komunala Novo mesto appends to otherwise stable
 * item names. Petrol can then match the exported D_7008 value to its configured
 * item instead of seeing a new item whenever a tariff or connection size changes.
 */
export function normalizeKomunalaDescription(description: string): string {
  let normalized = description.trim().replace(/\s+/g, ' ')

  // Examples: "II 1-DN 25-OSTALI" and "II DN 25 - OSTALI".
  normalized = normalized.replace(/\s+(?:1-)?DN\s*\d+\s*-\s*OSTALI$/i, '')

  // Keep the stable "- N" part and remove the changing tariff label or code.
  normalized = normalized.replace(/(\s*-\s*N)\s+OSNOVNA\s+TARIFA$/i, '$1')
  normalized = normalized.replace(/(\s*-\s*N)\s+\d{4,}$/i, '$1')

  // The treatment-plant marker is not part of Petrol's configured item name.
  if (/^OKOL\.\s*DAJATEV\s+ODP\.\s*VODE\b/i.test(normalized)) {
    normalized = normalized.replace(/\s+ČN$/i, '')
  }

  return normalized.trim().replace(/\s+/g, ' ')
}
