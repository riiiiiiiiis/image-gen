'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { WordEntry } from '@/types';
import { RefreshCw, Download, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { activityManager } from './ActivityLog';
import { queueImageService, generatePromptsBatchService } from '@/lib/apiClient';
import { processBatch } from '@/lib/batchUtils';

export default function Gallery() {
  const { entries, updateEntry } = useAppStore();
  const [qaFilter, setQaFilter] = useState<'all' | 'good' | 'bad' | 'unrated'>('all');
  const [galleryImages, setGalleryImages] = useState<any[]>([]);

  // Load gallery images from JSON
  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => setGalleryImages(data.images || []))
      .catch(err => console.error('Failed to load gallery:', err));
  }, []);

  const entriesWithImages = useMemo(() => {
    return entries.filter(entry => entry.imageUrl && entry.imageStatus === 'completed');
  }, [entries]);

  // Combine entries with standalone gallery images
  const allImages = useMemo(() => {
    const entryImages = entriesWithImages.map(entry => ({
      ...entry,
      source: 'entries'
    }));
    
    const standaloneImages = galleryImages
      .filter(img => !entriesWithImages.find(entry => entry.id === img.id))
      .map(img => {
        // Find matching entry from all entries (including those without images)
        const matchingEntry = entries.find(entry => entry.id === img.id);
        
        return {
          id: img.id,
          original_text: matchingEntry?.original_text || `Image ${img.id}`,
          translation_text: matchingEntry?.translation_text || '',
          transcription: matchingEntry?.transcription || '',
          imageUrl: `/images/${img.id}.png`,
          imageStatus: 'completed',
          source: 'gallery',
          prompt: matchingEntry?.prompt
        };
      });
    
    return [...entryImages, ...standaloneImages];
  }, [entriesWithImages, galleryImages, entries]);

  const filteredEntries = useMemo(() => {
    let filtered = allImages;
    
    // Apply QA filter
    if (qaFilter === 'good') {
      filtered = filtered.filter(entry => entry.qaScore === 'good');
    } else if (qaFilter === 'bad') {
      filtered = filtered.filter(entry => entry.qaScore === 'bad');
    } else if (qaFilter === 'unrated') {
      filtered = filtered.filter(entry => !entry.qaScore);
    }
    
    // Sort by generation date - newest images first
    filtered.sort((a, b) => {
      const dateA = a.imageGeneratedAt ? new Date(a.imageGeneratedAt).getTime() : 0;
      const dateB = b.imageGeneratedAt ? new Date(b.imageGeneratedAt).getTime() : 0;
      return dateB - dateA; // Descending order - newest first, oldest last
    });
    
    return filtered;
  }, [allImages, qaFilter]);

  const handleQaScore = (entryId: number, score: 'good' | 'bad') => {
    updateEntry(entryId, { qaScore: score });
    toast.success(`Marked as ${score === 'good' ? '✅ Good' : '❌ Bad'}`);
  };

  const handleRegenerateImage = async (entry: WordEntry) => {
    if (!entry.prompt) {
      toast.error('No prompt available for regeneration');
      return;
    }

    const operationKey = `regen-image-${entry.id}`;
    updateEntry(entry.id, { imageStatus: 'queued' });
    activityManager.addActivity('loading', `Queuing regeneration for "${entry.original_text}"`, undefined, operationKey);
    
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
        qaScore: null, // Reset QA score for new image
        imageGeneratedAt: result.data.generatedAt // Update generation timestamp
      });
      activityManager.addActivity('success', `Image regenerated for "${entry.original_text}"`, undefined, operationKey);
      toast.success('Image regenerated successfully');
    } else {
      updateEntry(entry.id, { imageStatus: 'completed' }); // Revert to previous state
      activityManager.addActivity('error', `Failed to regenerate image for "${entry.original_text}"`, result.error || 'Failed to regenerate image', operationKey);
      toast.error(`Failed to regenerate: ${result.error || 'Unknown error'}`);
    }
  };

  // Image download functionality has been removed

  const handleExportAll = () => {
    activityManager.addActivity('loading', 'Exporting data...');
    
    try {
      const exportData = entries.map(entry => ({
        ...entry,
        imageStatus: undefined,
        promptStatus: undefined,
        replicateId: undefined,
      }));
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'language-cards-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      const stats = {
        total: entries.length,
        withPrompts: entries.filter(e => e.prompt).length,
        withImages: entries.filter(e => e.imageUrl).length,
      };
      
      activityManager.addActivity('success', 'Data exported successfully', 
        `${stats.total} entries, ${stats.withPrompts} prompts, ${stats.withImages} images`);
    } catch (error) {
      activityManager.addActivity('error', 'Failed to export data');
    }
  };

  const handleBatchRefreshBadPrompts = async () => {
    // Filter entries with bad QA score - use all entries, not just filtered gallery images
    const badEntries = entries.filter(entry => entry.qaScore === 'bad');
    
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

  if (allImages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No images found</p>
        <p className="text-sm mt-2 text-gray-500">
          Go to the Data Table tab to generate images or add images to public/images/
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <select
            value={qaFilter}
            onChange={(e) => setQaFilter(e.target.value as 'all' | 'good' | 'bad' | 'unrated')}
            className="input-field w-40"
          >
            <option value="all">All Images</option>
            <option value="good">✅ Good Images</option>
            <option value="bad">❌ Bad Images</option>
            <option value="unrated">⚪ Unrated</option>
          </select>
          
          <span className="text-sm text-gray-400">
            {filteredEntries.length} cards
          </span>
        </div>
        
        <div className="flex gap-2">
          {/* Show refresh button when there are bad entries */}
          {entries.filter(entry => entry.qaScore === 'bad').length > 0 && (
            <button
              onClick={handleBatchRefreshBadPrompts}
              className="btn-secondary flex items-center gap-2"
              title="Generate new prompts for all bad entries"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Bad ({entries.filter(entry => entry.qaScore === 'bad').length})
            </button>
          )}
          
          <button onClick={handleExportAll} className="btn-primary">
            <Download className="h-4 w-4" />
            [EXPORT]
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
        {filteredEntries.map((entry) => {
          return (
            <div key={entry.id} className="bg-gray-900 border border-gray-700 rounded overflow-hidden group hover:border-gray-600 transition-colors">
              {/* Compact Image Display */}
              <div className="relative w-full aspect-square">
                <img
                  src={entry.imageUrl!}
                  alt={entry.original_text}
                  className="w-full h-full object-contain bg-gray-800"
                />
                
                {/* QA Score Indicator */}
                {entry.qaScore && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center bg-black/60">
                    {entry.qaScore === 'good' ? '✅' : '❌'}
                  </div>
                )}
              </div>
              
              {/* Compact Card Info */}
              <div className="p-2 space-y-2">
                {/* Word Info */}
                <div>
                  <h3 className="font-medium text-gray-100 text-sm truncate" title={entry.original_text}>
                    {entry.original_text}
                  </h3>
                  <p className="text-xs text-gray-400 truncate" title={entry.translation_text}>
                    {entry.translation_text}
                  </p>
                  <div className="text-xs text-gray-500">ID: {entry.id}</div>
                </div>
                
                {/* Compact Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleQaScore(entry.id, 'good')}
                    className={`flex-1 py-1 px-2 rounded text-xs transition-colors ${
                      entry.qaScore === 'good'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-green-600/20'
                    }`}
                    title="Mark as good"
                  >
                    ✅
                  </button>
                  <button
                    onClick={() => handleQaScore(entry.id, 'bad')}
                    className={`flex-1 py-1 px-2 rounded text-xs transition-colors ${
                      entry.qaScore === 'bad'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-red-600/20'
                    }`}
                    title="Mark as bad"
                  >
                    ❌
                  </button>
                  <button
                    onClick={() => handleRegenerateImage(entry)}
                    disabled={entry.imageStatus === 'processing'}
                    className="flex-1 py-1 px-2 bg-blue-800 text-blue-300 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 rounded text-xs transition-colors"
                    title="Regenerate image"
                  >
                    {entry.imageStatus === 'processing' ? (
                      <div className="loading-spinner h-3 w-3 mx-auto" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mx-auto" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}