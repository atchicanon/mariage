import { create } from 'zustand'
import type { Wedding } from '../types/database'

interface WeddingStore {
  weddings: Wedding[]
  activeWeddingId: string | null
  isLoading: boolean
  setWeddings: (weddings: Wedding[]) => void
  setActiveWedding: (id: string) => void
  setLoading: (loading: boolean) => void
  updateWedding: (updated: Wedding) => void
  addWedding: (wedding: Wedding) => void
  getActiveWedding: () => Wedding | undefined
}

export const useWeddingStore = create<WeddingStore>((set, get) => ({
  weddings: [],
  activeWeddingId: null,
  isLoading: true,
  setWeddings: (weddings) => set({ weddings }),
  setActiveWedding: (id) => set({ activeWeddingId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateWedding: (updated) =>
    set((state) => ({
      weddings: state.weddings.map((w) => (w.id === updated.id ? updated : w)),
    })),
  addWedding: (wedding) =>
    set((state) => ({ weddings: [...state.weddings, wedding] })),
  getActiveWedding: () => {
    const { weddings, activeWeddingId } = get()
    return weddings.find((w) => w.id === activeWeddingId)
  },
}))
