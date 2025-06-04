import { create } from 'zustand';
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
  syncWithDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
  isInitialized: boolean;
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

export const useAppStore = create<AppStore>()((set, get) => ({
      ...initialState,
      isInitialized: false,
      
      setEntries: async (entries) => {
        set({ entries, currentPage: 1 });
        
        // Sync to database in background
        try {
          await fetch('/api/language-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entries),
          });
        } catch (error) {
          console.error('Failed to sync entries to database:', error);
        }
      },
      
      updateEntry: async (id, updates) => {
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, ...updates } : entry
          ),
        }));
        
        // Update in database
        try {
          await fetch('/api/language-cards', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, updates }),
          });
        } catch (error) {
          console.error('Failed to update entry in database:', error);
        }
      },
      
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
      
      clearData: async () => {
        set(initialState);
        // Note: We don't clear the database here to preserve data
      },
      
      syncWithDatabase: async () => {
        const state = get();
        if (state.entries.length > 0) {
          try {
            await fetch('/api/language-cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(state.entries),
            });
          } catch (error) {
            console.error('Failed to sync with database:', error);
          }
        }
      },
      
      loadFromDatabase: async () => {
        console.log('🔄 Store: Starting loadFromDatabase...');
        try {
          const response = await fetch('/api/language-cards');
          console.log('📡 Store: API response status:', response.status);
          if (response.ok) {
            const entries = await response.json();
            console.log('📊 Store: Loaded entries:', entries.length);
            if (entries.length > 0) {
              set({ entries, isInitialized: true });
            } else {
              set({ isInitialized: true });
            }
          } else {
            console.log('⚠️ Store: API response not ok');
            set({ isInitialized: true });
          }
        } catch (error) {
          console.error('❌ Store: Failed to load from database:', error);
          set({ isInitialized: true });
        }
        console.log('✅ Store: loadFromDatabase completed');
      },
    }));

// Initialize database on first load
if (typeof window !== 'undefined') {
  useAppStore.getState().loadFromDatabase();
}