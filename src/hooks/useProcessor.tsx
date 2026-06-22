import { useState, useRef, useCallback } from 'react'
import { parseEslogXml } from '../eslog/parser'
import { classifyLine, builtInKomunalaNovoMesto } from '../eslog/classifier'
import { buildDerivedXml } from '../eslog/transformer'
import { validateParsed } from '../eslog/validator'
import { buildZip } from '../export/zip'

export type FileStatus = 'pending' | 'processing' | 'done' | 'failed' | 'refused'

export interface OutputFile {
  filename: string
  content: string | Uint8Array
  type: 'water' | 'waste' | 'report'
}

export interface FileEntry {
  id: string
  name: string
  status: FileStatus
  message?: string
  outputs: OutputFile[]
  detectedReference?: {
    water?: { AWE?: string | null; AVE?: string | null; confidence?: number }
    waste?: { AWE?: string | null; AVE?: string | null; confidence?: number }
  }
  lines?: { lineId: string; serviceCode?: string; category?: 'water' | 'waste' | 'unknown' }[]
}

export function useProcessor() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const processingRef = useRef(false)
  const queueRef = useRef<Array<{ file: File; entry: FileEntry }>>([])

  const addFiles = useCallback((list: File[]) => {
    const entries = list.map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, name: f.name, status: 'pending' as FileStatus, outputs: [] }))
    setFiles((s) => [...entries, ...s])
    list.forEach((f, i) => queueRef.current.push({ file: f, entry: entries[i] }))
    if (!processingRef.current) drainQueue()
  }, [])

  async function drainQueue() {
    processingRef.current = true
    while (queueRef.current.length > 0) {
      const { file, entry } = queueRef.current.shift()!
      await processOne(file, entry)
    }
    processingRef.current = false
  }

  async function processOne(file: File, entry: FileEntry) {
    setFiles((s) => s.map((x) => x.id === entry.id ? { ...x, status: 'processing' } : x))
    try {
      if (!file.name.toLowerCase().endsWith('.xml')) {
        setFiles((s) => s.map((x) => x.id === entry.id ? { ...x, status: 'refused', message: 'Ni XML datoteka' } : x))
        return
      }
      const text = await file.text()
      const parsed = parseEslogXml(text, file.name)

      const validation = validateParsed(parsed)
      if (!validation.ok) {
        setFiles((s) => s.map((x) => x.id === entry.id ? { ...x, status: 'failed', message: validation.errors.join('; ') } : x))
        return
      }

      const waterLineIds = new Set<string>()
      const wasteLineIds = new Set<string>()
      const lineSummaries: FileEntry['lines'] = []
      const waterAwe: Record<string, number> = {}
      const waterAve: Record<string, number> = {}
      const wasteAwe: Record<string, number> = {}
      const wasteAve: Record<string, number> = {}
      parsed.lines.forEach((l) => {
        const c = classifyLine(l, builtInKomunalaNovoMesto)
        lineSummaries.push({ lineId: l.lineId, serviceCode: l.serviceCode, category: c.category })
        if (c.category === 'water') {
          waterLineIds.add(l.lineId)
          if (l.AWE) waterAwe[l.AWE] = (waterAwe[l.AWE] || 0) + 1
          if (l.AVE) waterAve[l.AVE] = (waterAve[l.AVE] || 0) + 1
        }
        if (c.category === 'waste') {
          wasteLineIds.add(l.lineId)
          if (l.AWE) wasteAwe[l.AWE] = (wasteAwe[l.AWE] || 0) + 1
          if (l.AVE) wasteAve[l.AVE] = (wasteAve[l.AVE] || 0) + 1
        }
      })
      if (waterLineIds.size > 0) {
        const xml = buildDerivedXml(parsed, 'water', waterLineIds)
        entry.outputs.push({ filename: file.name.replace(/\.xml$/i, '') + '_water.xml', content: xml, type: 'water' })
      }
      if (wasteLineIds.size > 0) {
        const xml = buildDerivedXml(parsed, 'waste', wasteLineIds)
        entry.outputs.push({ filename: file.name.replace(/\.xml$/i, '') + '_waste.xml', content: xml, type: 'waste' })
      }
      const pickMost = (map: Record<string, number>) => {
        const entries = Object.entries(map)
        if (entries.length === 0) return null
        entries.sort((a, b) => b[1] - a[1])
        return { val: entries[0][0], confidence: entries[0][1] / entries.reduce((s, [_k, v]) => s + v, 0) }
      }
      const awePick = pickMost(waterAwe)
      const avePick = pickMost(waterAve)
      const wasteAwePick = pickMost(wasteAwe)
      const wasteAvePick = pickMost(wasteAve)
      entry.detectedReference = {
        water: { AWE: awePick?.val ?? null, AVE: avePick?.val ?? null, confidence: Math.max(awePick?.confidence || 0, avePick?.confidence || 0) },
        waste: { AWE: wasteAwePick?.val ?? null, AVE: wasteAvePick?.val ?? null, confidence: Math.max(wasteAwePick?.confidence || 0, wasteAvePick?.confidence || 0) }
      }
      entry.lines = lineSummaries
      setFiles((s) => s.map((x) => x.id === entry.id ? { ...x, status: 'done', outputs: entry.outputs, detectedReference: entry.detectedReference, lines: entry.lines } : x))
    } catch (err: any) {
      setFiles((s) => s.map((x) => x.id === entry.id ? { ...x, status: 'failed', message: err?.message || String(err) } : x))
    }
  }

  const anyProcessing = files.some((f) => f.status === 'processing' || f.status === 'pending')

  const downloadAll = useCallback(async (selectedOnly: string[] | null = null) => {
    const structure: Record<string, string | Uint8Array> = {}
    files.forEach((f) => {
      if (f.status !== 'done') return
      if (selectedOnly && !selectedOnly.includes(f.id)) return
      f.outputs.forEach((o) => {
        let name = o.filename
        let suffix = 1
        while (structure[`${o.type}/${name}`]) {
          suffix++
          name = `${o.filename.replace(/(\.xml)?$/, '')}_${String(suffix).padStart(2, '0')}.xml`
        }
        structure[`${o.type}/${name}`] = o.content
      })
    })
    structure['reports/manifest.json'] = JSON.stringify({ generated: new Date().toISOString(), count: Object.keys(structure).length }, null, 2)
    const zipData = await buildZip(structure)
    const blob = new Blob([zipData], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eslog-utility-splitter_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '_')}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [files])

  return { files, addFiles, anyProcessing, downloadAll }
}
