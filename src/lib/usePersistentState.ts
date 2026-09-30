import { useEffect, useState } from 'react'

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved ? (JSON.parse(saved) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Persistence is a convenience layer; the app should keep working without it.
    }
  }, [key, value])

  return [value, setValue] as const
}
