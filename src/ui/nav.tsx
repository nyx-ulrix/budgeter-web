import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { ParsedReceipt } from '../core/receipt'

export type Tab = 'home' | 'txns' | 'budget' | 'macros' | 'profile'

/** Screens pushed over the tabs. */
export type Screen =
  | { kind: 'expense'; id?: string; receipt?: ParsedReceipt; ocrText?: string; tripId?: string; dateId?: string }
  | { kind: 'planned'; id?: string }
  | { kind: 'trip'; id: string }
  | { kind: 'ai' }
  | { kind: 'sync' }
  | { kind: 'editSetup' }
  | { kind: 'credits' }

export interface Nav {
  tab: Tab
  stack: Screen[]
  top: Screen | undefined
  go: (s: Screen) => void
  back: () => void
  reset: (t: Tab) => void
}

const Ctx = createContext<Nav | null>(null)
export const useNav = () => useContext(Ctx)!

/**
 * Tab + a stack of screens, no navigation library. Each pushed screen adds a browser history entry,
 * so the browser's back button (and Android's back gesture in a browser) goes back a screen.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('home')
  const [stack, setStack] = useState<Screen[]>([])

  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const nav = useMemo<Nav>(() => ({
    tab, stack, top: stack[stack.length - 1],
    go: (s) => { window.history.pushState({ depth: stack.length + 1 }, ''); setStack((st) => [...st, s]) },
    back: () => { if (stack.length) window.history.back() },
    reset: (t) => { if (stack.length) window.history.go(-stack.length); setStack([]); setTab(t) },
  }), [tab, stack])

  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>
}
