import { create } from 'zustand'
import type { Wedding } from '../types/database'

interface WeddingStore {
  weddings: Wedding[]
  activeWeddingId: string | null
  setWeddings: (weddings: Wedding[]) => void
  setActiveWedding: (id: string) => void
  getActiveWedding: () => Wedding | undefined
}

export const useWeddingStore = create<WeddingStore>((set, get) => ({
  weddings: [],
  activeWeddingId: null,
  setWeddings: (weddings) => set({ weddings }),
  setActiveWedding: (id) => set({ activeWeddingId: id }),
  getActiveWedding: () => {
    const { weddings, activeWeddingId } = get()
    return weddings.find((w) => w.id === activeWeddingId)
  },
}))
