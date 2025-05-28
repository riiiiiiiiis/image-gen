import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordEntry, AppState } from '@/types';

interface AppStore extends AppState {
  setEntries: (entries: WordEntry[]) => void;
  updateEntry: (id: number, updates: Partial<WordEntry>) => void;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
  setSearchQuery: (query: string) => void;
  setLevelFilter: (level: number | null) => void;
  setSortBy: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setActiveTab: (tab: 'table' | 'gallery') => void;
  getFilteredEntries: () => WordEntry[];
  clearData: () => void;
}

const initialState: AppState = {
  entries: [],
  currentPage: 1,
  itemsPerPage: 100,
  searchQuery: '',
  levelFilter: null,
  sortBy: 'id',
  sortOrder: 'asc',
  activeTab: 'table',
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setEntries: (entries) => set({ entries, currentPage: 1 }),
      
      updateEntry: (id, updates) => set((state) => ({
        entries: state.entries.map((entry) =>
          entry.id === id ? { ...entry, ...updates } : entry
        ),
      })),
      
      setCurrentPage: (currentPage) => set({ currentPage }),
      setItemsPerPage: (itemsPerPage) => set({ itemsPerPage, currentPage: 1 }),
      setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
      setLevelFilter: (levelFilter) => set({ levelFilter, currentPage: 1 }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setActiveTab: (activeTab) => set({ activeTab }),
      
      getFilteredEntries: () => {
        const state = get();
        let filtered = [...state.entries];
        
        // Apply search filter
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (entry) =>
              entry.original_text.toLowerCase().includes(query) ||
              entry.translation_text.toLowerCase().includes(query) ||
              entry.transcription.toLowerCase().includes(query) ||
              (entry.prompt && entry.prompt.toLowerCase().includes(query))
          );
        }
        
        // Apply level filter
        if (state.levelFilter !== null) {
          filtered = filtered.filter((entry) => entry.level_id === state.levelFilter);
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
          let aVal = a[state.sortBy as keyof WordEntry];
          let bVal = b[state.sortBy as keyof WordEntry];
          
          if (aVal === undefined || bVal === undefined) return 0;
          
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
          }
          
          if (aVal < bVal) return state.sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return state.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        
        return filtered;
      },
      
      clearData: () => set(initialState),
    }),
    {
      name: 'language-card-storage',
      partialize: (state) => ({
        entries: state.entries,
      }),
    }
  )
);