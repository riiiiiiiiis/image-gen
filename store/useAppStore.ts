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
        set(state => ({ ...state, isInitialized: false })); // Indicate loading starts
        try {
          const response = await fetch('/api/language-cards');
          if (response.ok) {
            let loadedEntries: WordEntry[] = await response.json();
            const entries = loadedEntries.map(entry => {
              const updatedEntry = { ...entry };
              if (updatedEntry.promptStatus === 'generating') {
                // Prompt generation was interrupted, reset status
                updatedEntry.promptStatus = 'error'; 
                console.log(`Resetting stuck promptStatus 'generating' to 'error' for entry ID ${entry.id}`);
              }
              if (updatedEntry.imageStatus === 'processing') {
                // Single image generation was interrupted, reset status
                updatedEntry.imageStatus = 'error';
                console.log(`Resetting stuck imageStatus 'processing' to 'error' for entry ID ${entry.id}`);
              }
              if (updatedEntry.imageStatus === 'queued') {
                // If it's 'queued' and has an image, it's likely an error or incomplete update from a previous batch.
                // If it's 'queued' and has NO image, it's a truly stale queue item that never started.
                if (updatedEntry.imageUrl) {
                    updatedEntry.imageStatus = 'error';
                    console.log(`Resetting stuck imageStatus 'queued' (with image) to 'error' for entry ID ${entry.id}`);
                } else {
                    updatedEntry.imageStatus = 'none';
                    console.log(`Resetting stuck imageStatus 'queued' (no image) to 'none' for entry ID ${entry.id}`);
                }
              }
              return updatedEntry;
            });
            set({ entries, isInitialized: true });
          } else {
            console.error('Failed to load from database, server responded with an error:', response.status);
            set({ entries: [], isInitialized: true }); // Initialize with empty on server error, but mark as done
          }
        } catch (error) {
          console.error('Failed to load from database (network error or JSON parsing issue):', error);
          set({ entries: [], isInitialized: true }); // Initialize with empty on catch, but mark as done
        }
      },
    }));

// Initialize database on first load
if (typeof window !== 'undefined') {
  useAppStore.getState().loadFromDatabase();
}