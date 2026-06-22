import { buildZip } from '../src/export/zip'

test('builds a zip with files', async () => {
  const data = await buildZip({ 'a.txt': 'hello', 'dir/b.txt': 'x' })
  expect(data.byteLength).toBeGreaterThan(10)
})
