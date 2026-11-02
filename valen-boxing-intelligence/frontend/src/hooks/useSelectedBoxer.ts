import { useState } from 'react'

const STORAGE_KEY = 'valen-selected-boxer'

export function useSelectedBoxer() {
  const [boxerId, setBoxerIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || ''
  })

  const setBoxerId = (id: string) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    setBoxerIdState(id)
  }

  return { boxerId, setBoxerId }
}
