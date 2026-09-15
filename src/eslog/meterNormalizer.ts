/**
 * Petrol's configured water points use the internal form `<base>.000.1`, while
 * some Komunala invoices repeat the base as `<base>.<base>`. Only that exact,
 * unambiguous shape is converted; all other references remain untouched.
 */
export function normalizeKomunalaWaterMeterReference(reference: string): string {
  const normalized = reference.trim()
  const repeatedBase = /^(\d{6,})\.\1$/.exec(normalized)
  return repeatedBase ? `${repeatedBase[1]}.000.1` : normalized
}
