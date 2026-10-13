import React, { createContext, createElement, ReactNode, useContext, useRef, useState } from 'react'
import { Ai, parse } from '../ai/ai'
import type { ParsedReceipt } from '../core/receipt'
import * as ReceiptText from '../core/receiptText'
import { store } from '../data/store'
import { activeTrip, currency } from '../data/ledger'

export interface Scanner {
  busy: boolean
  status: string
  /** Opens the camera on a phone (the browser's own capture), or the file chooser on a computer. */
  camera: () => void
  /** Picks a saved screenshot or photo. */
  screenshot: () => void
}

const Ctx = createContext<Scanner | null>(null)
export const useScanner = () => useContext(Ctx)!

/** The photo as a JPEG data URL, longest side at most 1600 px: enough to read, small to send. */
async function photo(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

/** Text read in the browser with Tesseract (downloads its engine and English data the first time). */
async function ocr(file: File, onStatus: (s: string) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const w = await createWorker('eng', 1, { logger: (m: any) => m.status === 'recognizing text' && onStatus(`Reading text… ${Math.round(m.progress * 100)}%`) })
  try { return (await w.recognize(file)).data.text } finally { await w.terminate() }
}

/**
 * Scans a receipt. With an AI provider the photo itself goes to it; a model that can't read images gets the
 * text read in the browser instead, and without a provider (or if the AI fails) the built-in reader is used.
 */
export function ScannerProvider({ children, onResult }: { children: ReactNode; onResult: (r: ParsedReceipt, text: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const camInput = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  async function read(file: File) {
    setBusy(true)
    try {
      const st = store.get()
      const fallback = activeTrip(st)?.currency ?? currency(st)
      const provider = Ai.active()
      let text = ''
      const readText = async () => (text ||= await ocr(file, setStatus))
      let receipt: ParsedReceipt
      try {
        if (!provider) {
          setStatus('Reading text in your browser…')
          receipt = ReceiptText.parse(await readText(), fallback)
        } else {
          setStatus(`Sending the photo to ${provider.label}…`)
          try {
            receipt = await parse(provider, '', fallback, st.categories, await photo(file))
          } catch {
            setStatus('Reading text in your browser…')
            receipt = await parse(provider, await readText(), fallback, st.categories)
          }
        }
      } catch (e: any) {
        alert(`${e?.message ?? 'AI failed.'} Used the built-in reader instead.`)
        receipt = ReceiptText.parse(await readText(), fallback)
      }
      if (!text && !receipt.items.length && receipt.total == null) return alert('No receipt found. Try a sharper, flatter photo.')
      onResult(receipt, text)
    } catch {
      alert("Couldn't read that image.")
    } finally {
      setBusy(false)
    }
  }

  const input = (ref: React.MutableRefObject<HTMLInputElement | null>, capture: boolean) => createElement('input', {
    ref, type: 'file', accept: 'image/*', capture: capture ? 'environment' : undefined, style: { display: 'none' },
    onChange: (e: any) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) read(f) },
  })

  const scanner: Scanner = { busy, status, camera: () => camInput.current?.click(), screenshot: () => fileInput.current?.click() }
  return (
    <Ctx.Provider value={scanner}>
      {children}
      {input(camInput, true)}
      {input(fileInput, false)}
    </Ctx.Provider>
  )
}
