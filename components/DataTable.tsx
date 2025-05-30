'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useAppStore } from '@/store/useAppStore';
import { WordEntry } from '@/types';
import { ChevronUp, ChevronDown, Search, Filter, Sparkles, ImageIcon, Edit2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { activityManager } from './ActivityLog';

export default function DataTable() {
  const {
    entries,
    updateEntry,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    searchQuery,
    setSearchQuery,
    levelFilter,
    setLevelFilter,
    getFilteredEntries,
  } = useAppStore();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [imageFilter, setImageFilter] = useState<'all' | 'with' | 'without' | 'bad'>('all');
  const [promptFilter, setPromptFilter] = useState<'all' | 'with' | 'without'>('all');
  const batchMenuRef = useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    let data = getFilteredEntries();
    
    // Apply prompt filter
    if (promptFilter === 'with') {
      data = data.filter(entry => entry.prompt && entry.prompt.trim() !== '');
    } else if (promptFilter === 'without') {
      data = data.filter(entry => !entry.prompt || entry.prompt.trim() === '');
    }
    
    // Apply image filter
    if (imageFilter === 'with') {
      data = data.filter(entry => entry.imageUrl && entry.imageStatus === 'completed');
    } else if (imageFilter === 'without') {
      data = data.filter(entry => !entry.imageUrl || entry.imageStatus !== 'completed');
    } else if (imageFilter === 'bad') {
      data = data.filter(entry => entry.qaScore === 'bad');
    }
    
    return data;
  }, [getFilteredEntries, entries, imageFilter, promptFilter]);

  // Click outside handler for batch menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (batchMenuRef.current && !batchMenuRef.current.contains(event.target as Node)) {
        setShowBatchMenu(false);
      }
    };

    if (showBatchMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBatchMenu]);

  const handleGeneratePrompt = async (entry: WordEntry) => {
    const operationKey = `prompt-${entry.id}`;
    updateEntry(entry.id, { promptStatus: 'generating' });
    activityManager.addActivity('loading', `Generating prompt for "${entry.original_text}"`, undefined, operationKey);
    
    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english: entry.original_text,
          russian: entry.translation_text,
          transcription: entry.transcription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { prompt } = await response.json();
      updateEntry(entry.id, { prompt, promptStatus: 'completed' });
      activityManager.addActivity('success', `Generated prompt for "${entry.original_text}"`, undefined, operationKey);
    } catch (error) {
      updateEntry(entry.id, { promptStatus: 'error' });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      activityManager.addActivity('error', `Failed to generate prompt for "${entry.original_text}"`, errorMessage, operationKey);
    }
  };

  const handleGenerateImage = async (entry: WordEntry) => {
    if (!entry.prompt) {
      toast.error(`No prompt available for "${entry.original_text}". Generate prompt first.`);
      return;
    }

    const operationKey = `image-${entry.id}`;
    updateEntry(entry.id, { imageStatus: 'queued' });
    activityManager.addActivity('loading', `Queuing image for "${entry.original_text}"`, undefined, operationKey);
    
    try {
      const response = await fetch('/api/queue-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          entryId: entry.id,
          englishWord: entry.original_text,
          prompt: entry.prompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { status, imageUrl, generatedAt } = await response.json();
      
      if (status === 'completed' && imageUrl) {
        updateEntry(entry.id, { 
          imageUrl, 
          imageStatus: 'completed',
          imageGeneratedAt: generatedAt 
        });
        activityManager.addActivity('success', `Image generated for "${entry.original_text}"`, undefined, operationKey);
      } else {
        throw new Error('Failed to generate image');
      }
    } catch (error) {
      updateEntry(entry.id, { imageStatus: 'error' });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      activityManager.addActivity('error', `Failed to generate image for "${entry.original_text}"`, errorMessage, operationKey);
    }
  };

  const handleEditPrompt = (entry: WordEntry) => {
    setEditingId(entry.id);
    setEditingPrompt(entry.prompt || '');
  };

  const handleSavePrompt = (id: number) => {
    console.log('Saving prompt:', { id, prompt: editingPrompt });
    updateEntry(id, { prompt: editingPrompt, promptStatus: 'completed' });
    setEditingId(null);
    setEditingPrompt('');
    toast.success('Prompt saved');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingPrompt('');
  };

  const handleBatchGeneratePrompts = async (count: number) => {
    // Get entries without prompts
    const entriesWithoutPrompts = filteredData
      .filter(entry => !entry.prompt || entry.prompt.trim() === '')
      .slice(0, count);
    
    if (entriesWithoutPrompts.length === 0) {
      toast.error('No entries without prompts found');
      return;
    }

    const operationKey = `batch-prompts-${Date.now()}`;
    activityManager.addActivity(
      'loading', 
      `Generating prompts for ${entriesWithoutPrompts.length} words...`, 
      undefined, 
      operationKey
    );

    // Update status for all entries being processed
    entriesWithoutPrompts.forEach(entry => {
      updateEntry(entry.id, { promptStatus: 'generating' });
    });

    try {
      const response = await fetch('/api/generate-prompts-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entriesWithoutPrompts.map(entry => ({
            id: entry.id,
            english: entry.original_text,
            russian: entry.translation_text,
            transcription: entry.transcription,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { prompts } = await response.json();
      
      // Update all entries with their prompts
      prompts.forEach((result: { id: number; prompt: string }) => {
        updateEntry(result.id, {
          prompt: result.prompt,
          promptStatus: result.prompt === 'Failed to generate prompt' ? 'error' : 'completed',
        });
      });

      const successCount = prompts.filter((p: any) => p.prompt !== 'Failed to generate prompt').length;
      activityManager.addActivity(
        'success',
        `Generated ${successCount} prompts successfully`,
        undefined,
        operationKey
      );
      toast.success(`Generated ${successCount} prompts`);
    } catch (error) {
      // Reset status for all entries
      entriesWithoutPrompts.forEach(entry => {
        updateEntry(entry.id, { promptStatus: 'error' });
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      activityManager.addActivity(
        'error',
        'Failed to generate batch prompts',
        errorMessage,
        operationKey
      );
      toast.error(`Failed to generate prompts: ${errorMessage}`);
    }
  };

  const columns = useMemo<ColumnDef<WordEntry>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        size: 60,
      },
      {
        accessorKey: 'original_text',
        header: 'English',
        size: 200,
      },
      {
        accessorKey: 'transcription',
        header: 'Transcription',
        size: 180,
      },
      {
        accessorKey: 'translation_text',
        header: 'Russian',
        size: 200,
      },
      {
        accessorKey: 'level_id',
        header: 'Level',
        size: 60,
      },
      {
        id: 'hasImage',
        header: 'Image',
        size: 80,
        cell: ({ row }) => {
          const entry = row.original;
          const hasImage = entry.imageUrl && entry.imageStatus === 'completed';
          
          return (
            <div className="flex items-center justify-center">
              {hasImage ? (
                <div className="flex items-center gap-1 text-green-600">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-xs">✓</span>
                </div>
              ) : (
                <span className="text-gray-500 text-xs">-</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'qaScore',
        header: 'QA',
        size: 60,
        cell: ({ row }) => {
          const entry = row.original;
          
          return (
            <div className="flex items-center justify-center">
              {entry.qaScore === 'good' ? (
                <span className="text-green-600 text-sm">✅</span>
              ) : entry.qaScore === 'bad' ? (
                <span className="text-red-600 text-sm">❌</span>
              ) : (
                <span className="text-gray-500 text-xs">-</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'prompt',
        header: 'Prompt',
        size: 360,
        cell: ({ row }) => {
          const entry = row.original;
          const isEditing = editingId === entry.id;

          if (isEditing) {
            return (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingPrompt}
                  onChange={(e) => setEditingPrompt(e.target.value)}
                  className="input-field flex-1 text-xs"
                  placeholder="Enter prompt..."
                />
                <button
                  onClick={() => handleSavePrompt(entry.id)}
                  className="p-1 rounded hover:bg-gray-800"
                >
                  <Save className="h-4 w-4 text-green-600" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 rounded hover:bg-gray-800"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm truncate block min-w-0 text-gray-300" title={entry.prompt || ''}>
                {entry.prompt || <span className="text-gray-500">No prompt</span>}
              </span>
              <button
                onClick={() => handleEditPrompt(entry)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-800 flex-shrink-0"
              >
                <Edit2 className="h-3 w-3 text-gray-400" />
              </button>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 260,
        cell: ({ row }) => {
          const entry = row.original;
          
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleGeneratePrompt(entry)}
                disabled={entry.promptStatus === 'generating'}
                className="btn-secondary"
              >
                {entry.promptStatus === 'generating' ? (
                  <div className="loading-spinner" />
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    [PROMPT]
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleGenerateImage(entry)}
                disabled={!entry.prompt || (entry.imageStatus === 'processing' || entry.imageStatus === 'queued')}
                className="btn-primary"
              >
                {entry.imageStatus === 'processing' || entry.imageStatus === 'queued' ? (
                  <div className="loading-spinner" />
                ) : (
                  <>
                    <ImageIcon className="h-3 w-3" />
                    [IMAGE]
                  </>
                )}
              </button>
            </div>
          );
        },
      },
    ],
    [editingId, editingPrompt]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: itemsPerPage,
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    pageCount: Math.ceil(filteredData.length / itemsPerPage),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        
        <select
          value={promptFilter}
          onChange={(e) => setPromptFilter(e.target.value as 'all' | 'with' | 'without')}
          className="input-field w-40"
        >
          <option value="all">All Prompts</option>
          <option value="with">With Prompts</option>
          <option value="without">Without Prompts</option>
        </select>

        <select
          value={imageFilter}
          onChange={(e) => setImageFilter(e.target.value as 'all' | 'with' | 'without' | 'bad')}
          className="input-field w-40"
        >
          <option value="all">All Images</option>
          <option value="with">With Images</option>
          <option value="without">Without Images</option>
          <option value="bad">❌ Bad Images</option>
        </select>

        {/* Batch Generate Button */}
        <div className="relative" ref={batchMenuRef}>
          <button
            onClick={() => setShowBatchMenu(!showBatchMenu)}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Batch Generate
          </button>
          
          {showBatchMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-10">
              <div className="p-2">
                <div className="text-xs text-gray-400 mb-2">Generate prompts for:</div>
                {[10, 25, 50, 100, 200].map(count => (
                  <button
                    key={count}
                    onClick={() => {
                      handleBatchGeneratePrompts(count);
                      setShowBatchMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 rounded transition-colors"
                  >
                    First {count} words
                  </button>
                ))}
                <button
                  onClick={() => {
                    const allWithoutPrompts = filteredData.filter(e => !e.prompt || e.prompt.trim() === '').length;
                    handleBatchGeneratePrompts(allWithoutPrompts);
                    setShowBatchMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 rounded transition-colors border-t border-gray-700 mt-2 pt-2"
                >
                  All without prompts ({filteredData.filter(e => !e.prompt || e.prompt.trim() === '').length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full table-fixed">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="table-header">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-800"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="table-row group">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm" style={{ maxWidth: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              table.previousPage();
              setCurrentPage(currentPage - 1);
            }}
            disabled={!table.getCanPreviousPage()}
            className="btn-secondary"
          >
            ← PREV
          </button>
          <span className="flex items-center px-3 text-sm text-gray-400">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => {
              table.nextPage();
              setCurrentPage(currentPage + 1);
            }}
            disabled={!table.getCanNextPage()}
            className="btn-secondary"
          >
            NEXT →
          </button>
        </div>
      </div>
    </div>
  );
}