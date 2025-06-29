'use client';

import { useState, useMemo } from 'react';
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
import { ChevronUp, ChevronDown, Search, Filter, Sparkles, ImageIcon, Edit2, Save, X, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { activityManager } from './ActivityLog';
import { BatchActionMenu } from './BatchActionMenu';
import { PaginationControls } from './PaginationControls';
import {
  generatePromptService,
  queueImageService,
  generatePromptsBatchService,
  categorizeVocabularyService,
  batchGenerateImagesService,
  clearQueueService,
} from '@/lib/apiClient';
import { processBatch } from '@/lib/batchUtils';

export default function DataTable() {
  const {
    entries,
    updateEntry,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    searchQuery,
    setSearchQuery,
    getFilteredEntries,
  } = useAppStore();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  const [imageFilter, setImageFilter] = useState<'all' | 'with' | 'without' | 'bad'>('all');
  const [promptFilter, setPromptFilter] = useState<'all' | 'with' | 'without'>('all');
  const [categorizationFilter, setCategorizationFilter] = useState<'all' | 'uncategorized' | 'categorized'>('all');
  const [suitabilityFilter, setSuitabilityFilter] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
  const [customCategorizeCount, setCustomCategorizeCount] = useState<string>('10');
  const [customBatchGenerateCount, setCustomBatchGenerateCount] = useState<string>('10');
  const [customImageBatchCount, setCustomImageBatchCount] = useState<string>('20');

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
    
    // Apply categorization filter (NEW)
    if (categorizationFilter === 'uncategorized') {
      // Show entries that are not successfully categorized
      data = data.filter(entry =>
        !entry.categorization || entry.categorizationStatus !== 'completed'
      );
    } else if (categorizationFilter === 'categorized') {
      // Show entries that are successfully categorized
      data = data.filter(entry =>
        entry.categorization && entry.categorizationStatus === 'completed'
      );
    }
    
    // Apply suitability filter
    if (suitabilityFilter !== 'all') {
      data = data.filter(entry =>
        entry.categorization?.image_suitability === suitabilityFilter
      );
    }
    
    return data;
  }, [getFilteredEntries, entries, imageFilter, promptFilter, categorizationFilter, suitabilityFilter]);


  const handleGeneratePrompt = async (entry: WordEntry) => {
    const operationKey = `prompt-${entry.id}`;
    updateEntry(entry.id, { promptStatus: 'generating' });
    activityManager.addActivity('loading', `Generating prompt for "${entry.original_text}"`, undefined, operationKey);
    
    const result = await generatePromptService({
      entryId: entry.id,
      english: entry.original_text,
      russian: entry.translation_text,
      transcription: entry.transcription,
    });

    if (result.data) {
      updateEntry(entry.id, { prompt: result.data.prompt, promptStatus: 'completed' });
      activityManager.addActivity('success', `Generated prompt for "${entry.original_text}"`, undefined, operationKey);
    } else {
      updateEntry(entry.id, { promptStatus: 'error' });
      activityManager.addActivity('error', `Failed to generate prompt for "${entry.original_text}"`, result.error || 'Unknown error', operationKey);
    }
  };

  const handleGenerateImage = async (entry: WordEntry) => {
    if (!entry.prompt) {
      toast.error(`No prompt available for "${entry.original_text}". Generate prompt first.`);
      return;
    }

    const operationKey = `image-${entry.id}`;
    updateEntry(entry.id, { imageStatus: 'processing' });
    activityManager.addActivity('loading', `Processing image for "${entry.original_text}"`, undefined, operationKey);
    
    const result = await queueImageService({
      action: 'add',
      entryId: entry.id,
      englishWord: entry.original_text,
      prompt: entry.prompt,
    });

    if (result.data && result.data.status === 'completed' && result.data.imageUrl) {
      updateEntry(entry.id, { 
        imageUrl: result.data.imageUrl, 
        imageStatus: 'completed',
        imageGeneratedAt: result.data.generatedAt 
      });
      activityManager.addActivity('success', `Image generated for "${entry.original_text}"`, undefined, operationKey);
    } else {
      updateEntry(entry.id, { imageStatus: 'error' });
      activityManager.addActivity('error', `Failed to generate image for "${entry.original_text}"`, result.error || 'Failed to generate image', operationKey);
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

    const result = await processBatch({
      itemsToProcess: entriesWithoutPrompts,
      batchSize: entriesWithoutPrompts.length, // Process all at once for prompts
      delayBetweenBatchesMs: 0,
      operationName: 'Batch Prompt Generation',
      getBatchPayload: (batch) => ({
        entries: batch.map(entry => ({
          id: entry.id,
          english: entry.original_text,
          russian: entry.translation_text,
          transcription: entry.transcription,
        })),
      }),
      batchApiService: generatePromptsBatchService,
      getSuccessItems: (responseData, batchItems) => responseData.prompts || [],
      getErrorItems: (responseData) => [], // generatePromptsBatchService doesn't return separate errors array
      processItemSuccess: (result, originalEntry) => {
        updateEntry(result.id, {
          prompt: result.prompt,
          promptStatus: result.prompt === 'Failed to generate prompt' ? 'error' : 'completed',
        });
      },
      processItemError: (error, originalEntry) => {
        if (originalEntry) {
          updateEntry(originalEntry.id, { promptStatus: 'error' });
        }
      },
      onStartProcessingItem: (entry) => {
        updateEntry(entry.id, { promptStatus: 'generating' });
      },
    });

    toast.success(`Generated ${result.totalSuccess} prompts`);
  };

  const handleBatchCategorize = async (count: number) => {
    // Get entries without categorization
    const entriesWithoutCategorization = filteredData
      .filter(entry => !entry.categorization || entry.categorizationStatus !== 'completed')
      .slice(0, count);
    
    if (entriesWithoutCategorization.length === 0) {
      toast.error('No entries without categorization found');
      return;
    }

    const result = await processBatch({
      itemsToProcess: entriesWithoutCategorization,
      batchSize: 10, // API limit
      delayBetweenBatchesMs: 0,
      operationName: 'Batch Categorization (Selected)',
      getBatchPayload: (batch) => ({
        entries: batch.map(entry => ({
          id: entry.id,
          original_text: entry.original_text,
          translation_text: entry.translation_text,
          level_id: entry.level_id,
        })),
      }),
      batchApiService: categorizeVocabularyService,
      getSuccessItems: (responseData, batchItems) => responseData.results || [],
      getErrorItems: (responseData) => responseData.errors || [],
      processItemSuccess: (result, originalEntry) => {
        updateEntry(result.id, {
          categorization: result.categorization,
          categorizationStatus: 'completed',
        });
      },
      processItemError: (error, originalEntry) => {
        if (originalEntry) {
          updateEntry(originalEntry.id, { categorizationStatus: 'error' });
        }
      },
      onStartProcessingItem: (entry) => {
        updateEntry(entry.id, { categorizationStatus: 'processing' });
      },
    });

    toast.success(`Categorized ${result.totalSuccess} words`);
  };

  const handleCustomBatchCategorize = async (count: number) => {
    handleBatchCategorize(count);
  };

  const handleCustomBatchGeneratePrompts = async (count: number) => {
    handleBatchGeneratePrompts(count);
  };

  const startBatchImageGeneration = async (input: number | WordEntry[]) => {
    let itemsToProcess: WordEntry[];
    
    if (typeof input === 'number') {
      // Filter for entries that are eligible for image generation, excluding already queued/processing items
      itemsToProcess = filteredData
        .filter(entry => 
          entry.prompt && 
          entry.prompt.trim() !== '' && 
          entry.imageStatus !== 'queued' && 
          entry.imageStatus !== 'processing' && 
          (!entry.imageUrl || entry.imageStatus !== 'completed') && !entry.qaScore
        )
        .slice(0, input);
    } else {
      // Input is already a pre-filtered array
      itemsToProcess = input;
    }

    if (itemsToProcess.length === 0) {
      toast.error('No eligible entries found for image generation.');
      return;
    }

    const result = await processBatch({
      itemsToProcess,
      batchSize: 20, // Number of WordEntry items to group into a single call to /api/generate-images-batch
      delayBetweenBatchesMs: 300,
      operationName: 'Batch Image Enqueuing',
      getBatchPayload: (batch) => ({
        entries: batch.map(entry => ({
          entryId: entry.id,
          prompt: entry.prompt!,
          englishWord: entry.original_text
        }))
      }),
      batchApiService: batchGenerateImagesService,
      getSuccessItems: (responseData, batchItems) => {
        if (!responseData.success) return [];
        const errorEntryIds = new Set(responseData.errors?.map((e: any) => e.entryId) || []);
        return batchItems.filter(item => !errorEntryIds.has(item.id)).map(item => ({ 
          id: item.id, 
          serverMessage: responseData.message 
        }));
      },
      getErrorItems: (responseData) => responseData.errors || [],
      processItemSuccess: (result, originalEntry) => {
        // Item was successfully queued by the server as part of a batch API call.
        // Status already updated to 'queued' by onStartProcessingItem.
        // activityManager.addActivity('info', `Image for "${originalEntry.original_text}" (ID: ${originalEntry.id}) added to generation queue.`);
      },
      processItemError: (itemError, originalEntry) => {
        if (originalEntry) {
          updateEntry(originalEntry.id, { imageStatus: 'error' });
          activityManager.addActivity('error', `Failed to queue image for "${originalEntry.original_text}" (ID: ${originalEntry.id})`, itemError.error);
        } else if ((itemError as any).entryId) {
          activityManager.addActivity('error', `Failed to queue image for entry ID ${(itemError as any).entryId}`, itemError.error);
        } else {
          activityManager.addActivity('error', 'An item failed to queue for image generation', itemError.error);
        }
      },
      onStartProcessingItem: (entry) => {
        updateEntry(entry.id, { imageStatus: 'queued' });
      },
    });

    activityManager.addActivity('info', `Batch image enqueuing process initiated. ${result.totalSuccess} items acknowledged by server, ${result.totalFailed} items had enqueuing issues. Monitor queue status for generation progress.`);
  };

  const handleCustomBatchGenerateImages = async (count: number) => {
    // Get eligible entries once, excluding already queued/processing items
    const eligibleEntries = filteredData.filter(entry => 
      entry.prompt && 
      entry.prompt.trim() !== '' && 
      entry.imageStatus !== 'queued' && 
      entry.imageStatus !== 'processing' && 
      (!entry.imageUrl || entry.imageStatus !== 'completed') && !entry.qaScore
    );
    
    if (eligibleEntries.length === 0) {
      toast.error('No eligible entries found for image generation.');
      return;
    }
    
    const itemsForThisRun = eligibleEntries.slice(0, count);
    await startBatchImageGeneration(itemsForThisRun);
  };

  const handleBatchGenerateAllEligibleImages = async () => {
    const eligibleEntries = filteredData.filter(entry => 
      entry.prompt && 
      entry.prompt.trim() !== '' && 
      entry.imageStatus !== 'queued' && 
      entry.imageStatus !== 'processing' && 
      (!entry.imageUrl || entry.imageStatus !== 'completed') && !entry.qaScore
    );
    
    if (eligibleEntries.length === 0) {
      toast.error('No eligible entries found for image generation.');
      return;
    }
    
    await startBatchImageGeneration(eligibleEntries);
  };

  const handleBatchRegenerateBadImages = async () => {
    // Get all entries from the store to ensure we find all bad entries, not just filtered ones.
    const allEntries = useAppStore.getState().entries;
    const badEntriesWithPrompts = allEntries.filter(
      entry => entry.qaScore === 'bad' && 
      entry.prompt && 
      entry.prompt.trim() !== ''
    );

    if (badEntriesWithPrompts.length === 0) {
      toast.error('No "bad" entries with prompts found to regenerate.');
      return;
    }

    activityManager.addActivity('info', `Starting image regeneration for ${badEntriesWithPrompts.length} bad entries...`);

    // Process in chunks to avoid overwhelming the system
    const CHUNK_SIZE = 500;
    let processed = 0;
    
    while (processed < badEntriesWithPrompts.length) {
      const chunk = badEntriesWithPrompts.slice(processed, processed + CHUNK_SIZE);
      activityManager.addActivity('info', `Queueing batch ${Math.floor(processed / CHUNK_SIZE) + 1} (${chunk.length} images)...`);
      
      await startBatchImageGeneration(chunk);
      processed += chunk.length;
      
      // Add a small delay between chunks
      if (processed < badEntriesWithPrompts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    activityManager.addActivity('success', `All ${badEntriesWithPrompts.length} bad images have been queued for regeneration!`);
    toast.success(`Queued all ${badEntriesWithPrompts.length} bad images for regeneration!`);
  };

  const handleBatchRefreshBadPrompts = async () => {
    // Filter entries with bad QA score
    const badEntries = filteredData.filter(entry => entry.qaScore === 'bad');
    
    if (badEntries.length === 0) {
      toast.error('No bad entries found');
      return;
    }

    activityManager.addActivity('info', `Starting batch refresh for ${badEntries.length} bad entries...`);

    const result = await processBatch({
      itemsToProcess: badEntries,
      batchSize: badEntries.length, // Process all at once for prompts
      delayBetweenBatchesMs: 0,
      operationName: 'Batch Refresh Bad Prompts',
      getBatchPayload: (batch) => ({
        entries: batch.map(entry => ({
          id: entry.id,
          english: entry.original_text,
          russian: entry.translation_text,
          transcription: entry.transcription,
        })),
      }),
      batchApiService: generatePromptsBatchService,
      getSuccessItems: (responseData, batchItems) => responseData.prompts || [],
      getErrorItems: (responseData) => [], // generatePromptsBatchService doesn't return separate errors array
      processItemSuccess: (result, originalEntry) => {
        updateEntry(result.id, {
          prompt: result.prompt,
          promptStatus: result.prompt === 'Failed to generate prompt' ? 'error' : 'completed',
          qaScore: null,          // Reset QA score
          imageUrl: null,         // Remove old image URL
          imageStatus: 'none'     // Reset image status for new generation
        });
        activityManager.addActivity('success', `Refreshed prompt for "${originalEntry.original_text}"`);
      },
      processItemError: (error, originalEntry) => {
        if (originalEntry) {
          updateEntry(originalEntry.id, { promptStatus: 'error' });
          activityManager.addActivity('error', `Failed to refresh prompt for "${originalEntry.original_text}"`);
        }
      },
      onStartProcessingItem: (entry) => {
        updateEntry(entry.id, { promptStatus: 'generating' });
      },
    });

    const message = `Refreshed ${result.totalSuccess} prompts. ${result.totalFailed > 0 ? `${result.totalFailed} failed.` : ''}`;
    activityManager.addActivity('info', message);
    toast.success(message);
  };

  const handleClearQueue = async () => {
    if (!confirm('Are you sure you want to clear the entire image generation queue? This will remove all pending and processing items.')) {
      return;
    }

    try {
      activityManager.addActivity('info', 'Clearing image generation queue...');
      const result = await clearQueueService();
      
      if (result.data) {
        activityManager.addActivity('success', `Cleared ${result.data.clearedCount} items from the queue`);
        toast.success(`Cleared ${result.data.clearedCount} items from the queue`);
      } else {
        activityManager.addActivity('error', `Failed to clear queue: ${result.error}`);
        toast.error(`Failed to clear queue: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      activityManager.addActivity('error', `Error clearing queue: ${errorMessage}`);
      toast.error(`Error clearing queue: ${errorMessage}`);
    }
  };

  const handleCleanupDescriptivePrompts = async () => {
    activityManager.addActivity('info', 'Searching for descriptive prompts to clean up...');
    
    const allEntries = useAppStore.getState().entries;
    
    const junkKeywords = ['represent', 'visualize', 'show a', 'e.g.', 'could be', 'by showing', 'depict', 'as a'];

    const entriesToClean = allEntries.filter(entry => {
        // SAFETY PROTOCOL: First and most important check.
        // If the user marked it as 'good', we NEVER touch it.
        if (entry.qaScore === 'good') {
            return false;
        }

        const prompt = entry.prompt?.toLowerCase() || '';
        if (!prompt) return false;
        
        // Criteria for a bad prompt: contains junk keywords or is abnormally long.
        return prompt.length > 50 || junkKeywords.some(keyword => prompt.includes(keyword));
    });

    if (entriesToClean.length === 0) {
        toast.info('No actionable descriptive prompts found to clean up.');
        activityManager.addActivity('info', 'Cleanup not needed. No unapproved descriptive prompts found.');
        return;
    }

    activityManager.addActivity('info', `Found ${entriesToClean.length} prompts to clean. Starting process...`);

    const result = await processBatch({
        itemsToProcess: entriesToClean,
        batchSize: 20,
        delayBetweenBatchesMs: 200,
        operationName: 'Descriptive Prompts Cleanup',
        getBatchPayload: (batch) => ({
            entries: batch.map(e => ({
                id: e.id,
                english: e.original_text,
                russian: e.translation_text,
                transcription: e.transcription,
            })),
        }),
        batchApiService: generatePromptsBatchService,
        getSuccessItems: (data) => data.prompts || [],
        getErrorItems: (data) => data.errors || [],
        onStartProcessingItem: (entry) => {
            updateEntry(entry.id, { promptStatus: 'generating' });
        },
        processItemSuccess: (result, originalEntry) => {
            // Update the entry according to the safety protocol.
            // DO NOT modify imageUrl.
            updateEntry(result.id, {
                prompt: result.prompt,
                promptStatus: 'completed',
                qaScore: null,
                imageStatus: 'none', 
            });
        },
        processItemError: (error, originalEntry) => {
            if (originalEntry) {
                updateEntry(originalEntry.id, { promptStatus: 'error' });
            }
        },
    });

    const message = `Cleaned up ${result.totalSuccess} descriptive prompts. ${result.totalFailed > 0 ? `${result.totalFailed} failed.` : ''}`;
    activityManager.addActivity('info', message);
    toast.success(message);
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
        id: 'category',
        header: 'Category',
        size: 140,
        cell: ({ row }) => {
          const entry = row.original;
          if (!entry.categorization || entry.categorizationStatus !== 'completed') {
            return <span className="text-gray-500 text-xs">-</span>;
          }
          
          const categoryMap = {
            'CONCRETE-VISUAL': { label: 'Concrete', color: 'text-green-500' },
            'ABSTRACT-SYMBOLIC': { label: 'Abstract', color: 'text-blue-500' },
            'ACTION-VISUAL': { label: 'Action', color: 'text-orange-500' },
            'STATE-METAPHORICAL': { label: 'State', color: 'text-purple-500' }
          };
          
          const category = categoryMap[entry.categorization.primary_category];
          const suitability = entry.categorization.image_suitability;
          
          return (
            <div className="flex flex-col gap-1">
              <span className={`text-xs font-medium ${category.color}`}>
                {category.label}
              </span>
              <span className={`text-xs ${
                suitability === 'HIGH' ? 'text-green-400' : 
                suitability === 'MEDIUM' ? 'text-yellow-400' : 
                'text-red-400'
              }`}>
                {suitability}
              </span>
            </div>
          );
        },
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
        size: 280,
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

        <select
          value={categorizationFilter}
          onChange={(e) => setCategorizationFilter(e.target.value as 'all' | 'uncategorized' | 'categorized')}
          className="input-field w-48"
        >
          <option value="all">All Categories</option>
          <option value="uncategorized">Uncategorized (Needs TIAC)</option>
          <option value="categorized">Categorized (TIAC Done)</option>
        </select>

        <select
          value={suitabilityFilter}
          onChange={(e) => setSuitabilityFilter(e.target.value as 'all' | 'HIGH' | 'MEDIUM' | 'LOW')}
          className="input-field w-48"
        >
          <option value="all">All Suitabilities</option>
          <option value="HIGH">High Suitability</option>
          <option value="MEDIUM">Medium Suitability</option>
          <option value="LOW">Low Suitability</option>
        </select>

        {/* Batch Generate Prompts Menu */}
        <BatchActionMenu
          triggerButtonLabel="Batch Generate"
          triggerButtonIcon={<Sparkles className="h-4 w-4" />}
          menuTitle="Generate prompts for:"
          countInputState={[customBatchGenerateCount, setCustomBatchGenerateCount]}
          onCustomCountAction={handleCustomBatchGeneratePrompts}
          customCountActionLabel={(count) => `Generate First ${count || 'N'} Prompts`}
          onAllEligibleAction={() => {
            const allWithoutPromptsCount = filteredData.filter(e => !e.prompt || e.prompt.trim() === '').length;
            if (allWithoutPromptsCount > 0) {
              handleBatchGeneratePrompts(allWithoutPromptsCount);
            } else {
              toast.error('No entries without prompts found');
            }
          }}
          allEligibleActionLabel="All without prompts"
          getEligibleCount={() => filteredData.filter(e => !e.prompt || e.prompt.trim() === '').length}
        />

        {/* Categorization Menu */}
        <BatchActionMenu
          triggerButtonLabel="Categorize (TIAC)"
          triggerButtonIcon={<Filter className="h-4 w-4" />}
          menuTitle="Categorize vocabulary for:"
          countInputState={[customCategorizeCount, setCustomCategorizeCount]}
          onCustomCountAction={handleCustomBatchCategorize}
          customCountActionLabel={(count) => `Categorize First ${count || 'N'} Words`}
          onAllEligibleAction={() => {
            const allWithoutCategorization = filteredData.filter(e => !e.categorization || e.categorizationStatus !== 'completed').length;
            handleBatchCategorize(allWithoutCategorization);
          }}
          allEligibleActionLabel="All uncategorized"
          getEligibleCount={() => filteredData.filter(e => !e.categorization || e.categorizationStatus !== 'completed').length}
        />

        {/* Batch Images Menu */}
        <BatchActionMenu
          triggerButtonLabel="Batch Images"
          triggerButtonIcon={<ImageIcon className="h-4 w-4" />}
          menuTitle="Generate images for first:"
          countInputState={[customImageBatchCount, setCustomImageBatchCount]}
          onCustomCountAction={handleCustomBatchGenerateImages}
          customCountActionLabel={(count) => `Generate for ${count || 'N'} (Eligible)`}
          onAllEligibleAction={handleBatchGenerateAllEligibleImages}
          allEligibleActionLabel="All eligible"
          getEligibleCount={() => filteredData.filter(entry => 
            entry.prompt && 
            entry.prompt.trim() !== '' && 
            entry.imageStatus !== 'queued' && 
            entry.imageStatus !== 'processing' && 
            (!entry.imageUrl || entry.imageStatus !== 'completed') && !entry.qaScore
          ).length}
        />

        {/* Refresh Bad Prompts Button */}
        <button
          onClick={handleBatchRefreshBadPrompts}
          disabled={filteredData.filter(entry => entry.qaScore === 'bad').length === 0}
          className="btn-secondary flex items-center gap-2"
          title="Generate new prompts for all bad entries"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh Bad Prompts ({filteredData.filter(entry => entry.qaScore === 'bad').length})
        </button>

        {/* Regenerate Bad Images Button */}
        <button
          onClick={handleBatchRegenerateBadImages}
          disabled={filteredData.filter(entry => entry.qaScore === 'bad').length === 0}
          className="btn-secondary bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
          title="Regenerate images for all bad entries using their existing prompts"
        >
          <ImageIcon className="h-4 w-4" />
          Regen Bad Images ({filteredData.filter(entry => entry.qaScore === 'bad').length})
        </button>

        {/* Clear Queue Button */}
        <button
          onClick={handleClearQueue}
          className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
          title="Clear all items from the image generation queue"
        >
          <X className="h-4 w-4" />
          Clear Queue
        </button>

        {/* Cleanup Descriptive Prompts Button */}
        <button
          onClick={handleCleanupDescriptivePrompts}
          className="btn-primary bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
          title="Find and regenerate all unapproved prompts that are descriptive sentences instead of objects."
        >
          <Sparkles className="h-4 w-4" />
          Cleanup Descriptive Prompts
        </button>
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
        <PaginationControls
          currentPage={table.getState().pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPreviousPage={() => {
            table.previousPage();
            setCurrentPage(currentPage - 1);
          }}
          onNextPage={() => {
            table.nextPage();
            setCurrentPage(currentPage + 1);
          }}
        />
      </div>
    </div>
  );
}