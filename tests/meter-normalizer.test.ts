import { normalizeKomunalaWaterMeterReference } from '../src/eslog/meterNormalizer'

test('converts a repeated Komunala reference to Petrol internal meter format', () => {
  expect(normalizeKomunalaWaterMeterReference('201036901.201036901'))
    .toBe('201036901.000.1')
})

test.each([
  '201036901.000.1',
  '201016915.201016085',
  'AWE-123',
])('leaves a non-repeated meter reference unchanged: %s', (reference) => {
  expect(normalizeKomunalaWaterMeterReference(reference)).toBe(reference)
})
