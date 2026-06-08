import { create } from 'zustand'

interface UIState {
  sidebarOpen:    boolean
  activeBranchId: string | null
  toggleSidebar:  () => void
  setActiveBranch:(id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen:    true,
  activeBranchId: null,
  toggleSidebar:  () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveBranch:(id) => set({ activeBranchId: id }),
}))
