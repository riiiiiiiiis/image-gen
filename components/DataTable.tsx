'use client';

import { useState, useMemo, useCallback } from 'react';
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

  const filteredData = useMemo(() => getFilteredEntries(), [getFilteredEntries, entries]);

  const levels = useMemo(() => {
    const uniqueLevels = Array.from(new Set(entries.map(e => e.level_id)));
    return uniqueLevels.sort((a, b) => a - b);
  }, [entries]);

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
    if (!entry.prompt) return;

    const operationKey = `image-${entry.id}`;
    updateEntry(entry.id, { imageStatus: 'processing' });
    activityManager.addActivity('loading', `Generating image for "${entry.original_text}"`, undefined, operationKey);
    
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: entry.prompt,
          entryId: entry.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { imageUrl, status } = await response.json();
      
      if (status === 'completed' && imageUrl) {
        updateEntry(entry.id, { imageUrl, imageStatus: 'completed' });
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
        accessorKey: 'prompt',
        header: 'Prompt',
        size: 500,
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
            <div className="flex items-center gap-2">
              <span className="text-sm truncate flex-1 text-gray-300">
                {entry.prompt || <span className="text-gray-500">No prompt</span>}
              </span>
              <button
                onClick={() => handleEditPrompt(entry)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-800"
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
          value={levelFilter || ''}
          onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : null)}
          className="input-field w-32"
        >
          <option value="">All Levels</option>
          {levels.map(level => (
            <option key={level} value={level}>Level {level}</option>
          ))}
        </select>

        <select
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="input-field w-32"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full">
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
                  <td key={cell.id} className="px-4 py-3 text-sm">
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