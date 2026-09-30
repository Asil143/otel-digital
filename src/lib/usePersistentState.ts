import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'

const SYNC_EVENT = 'otel:storage-sync'

function read<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStored<T>(key: string, value: T) {
  try {
    const serialized = JSON.stringify(value)
    if (window.localStorage.getItem(key) === serialized) return
    window.localStorage.setItem(key, serialized)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: key }))
  } catch {
    // Persistence is a convenience layer; the app keeps working without it.
  }
}

export function readStored<T>(key: string, fallback: T): T {
  return read(key, fallback)
}

// Every component using the same key sees the same value, in this tab and across tabs.
export function usePersistentState<T>(key: string, initialValue: T) {
  const initialRef = useRef(initialValue)
  const [value, setValue] = useState<T>(() => read(key, initialValue))

  useEffect(() => {
    writeStored(key, value)
  }, [key, value])

  useEffect(() => {
    function sync(event: Event) {
      const changedKey = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail
      if (changedKey === key) setValue(read(key, initialRef.current))
    }
    window.addEventListener(SYNC_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SYNC_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [key])

  const update = useCallback((next: SetStateAction<T>) => setValue(next), [])
  return [value, update] as const
}
