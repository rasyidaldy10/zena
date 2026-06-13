import { useEffect, useReducer } from 'react'

// Store mode aktif yang ringan + reaktif, dipakai lintas komponen
// (mis. tab bar FAB ganti warna mengikuti mode dari Home).
export type AppMode = 'personal' | 'business'

let currentMode: AppMode = 'personal'
const listeners = new Set<() => void>()

export function setAppMode(m: AppMode) {
  if (m === currentMode) return
  currentMode = m
  listeners.forEach((l) => l())
}

export function getAppMode(): AppMode {
  return currentMode
}

export function useAppMode(): AppMode {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    return () => { listeners.delete(force) }
  }, [])
  return currentMode
}
