import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RecentSearch {
  query: string
  timestamp: number
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void

  // Búsquedas recientes
  recentSearches: RecentSearch[]
  addRecentSearch: (query: string) => void
  clearRecentSearches: () => void

  // Preferencias de tabla
  tablePageSize: number
  setTablePageSize: (size: number) => void

  // Filtros por página (persistentes)
  pageFilters: Record<string, Record<string, unknown>>
  setPageFilter: (page: string, key: string, value: unknown) => void
  clearPageFilters: (page: string) => void

  // Super admin: org context selector
  selectedOrgId: string | null
  setSelectedOrgId: (orgId: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Búsquedas recientes
      recentSearches: [],
      addRecentSearch: (query) => {
        if (!query.trim()) return

        const searches = get().recentSearches
        // Remover duplicados y mantener máximo 10
        const filtered = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase())
        const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, 10)
        set({ recentSearches: updated })
      },
      clearRecentSearches: () => set({ recentSearches: [] }),

      // Preferencias de tabla
      tablePageSize: 10,
      setTablePageSize: (size) => set({ tablePageSize: size }),

      // Filtros por página
      pageFilters: {},
      setPageFilter: (page, key, value) => {
        const current = get().pageFilters[page] || {}
        set({
          pageFilters: {
            ...get().pageFilters,
            [page]: { ...current, [key]: value },
          },
        })
      },
      clearPageFilters: (page) => {
        const { [page]: _, ...rest } = get().pageFilters
        set({ pageFilters: rest })
      },

      // Super admin: org context selector
      selectedOrgId: null,
      setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),
    }),
    {
      name: 'cuanty-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        recentSearches: state.recentSearches,
        tablePageSize: state.tablePageSize,
        selectedOrgId: state.selectedOrgId,
        // No persistir pageFilters para evitar datos obsoletos
      }),
    }
  )
)
