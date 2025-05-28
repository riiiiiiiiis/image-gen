'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { WordEntry } from '@/types';
import { Download, Filter, X } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { activityManager } from './ActivityLog';

export default function Gallery() {
  const { entries, levelFilter, setLevelFilter } = useAppStore();
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  const entriesWithImages = useMemo(() => {
    return entries.filter(entry => entry.imageUrl && entry.imageStatus === 'completed');
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (levelFilter === null) return entriesWithImages;
    return entriesWithImages.filter(entry => entry.level_id === levelFilter);
  }, [entriesWithImages, levelFilter]);

  const levels = useMemo(() => {
    const uniqueLevels = Array.from(new Set(entries.map(e => e.level_id)));
    return uniqueLevels.sort((a, b) => a - b);
  }, [entries]);

  const handleFlip = (id: number) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDownload = async (entry: WordEntry) => {
    if (!entry.imageUrl) return;
    
    activityManager.addActivity('loading', `Downloading image for "${entry.original_text}"`);
    
    try {
      const response = await fetch(entry.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entry.original_text}-${entry.id}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      activityManager.addActivity('success', `Downloaded image for "${entry.original_text}"`);
    } catch (error) {
      activityManager.addActivity('error', `Failed to download image for "${entry.original_text}"`);
    }
  };

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

  if (entriesWithImages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No images generated yet</p>
        <p className="text-sm mt-2 text-gray-500">
          Go to the Data Table tab to generate images
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
            value={levelFilter || ''}
            onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : null)}
            className="input-field w-32"
          >
            <option value="">All Levels</option>
            {levels.map(level => (
              <option key={level} value={level}>Level {level}</option>
            ))}
          </select>
          
          <span className="text-sm text-gray-400">
            {filteredEntries.length} cards
          </span>
        </div>
        
        <button onClick={handleExportAll} className="btn-primary">
          <Download className="h-4 w-4" />
          [EXPORT]
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredEntries.map((entry) => {
          const isFlipped = flippedCards.has(entry.id);
          
          return (
            <div key={entry.id} className="card-container">
              <div
                className={`card-flip ${isFlipped ? 'flipped' : ''}`}
                onClick={() => handleFlip(entry.id)}
              >
                {/* Front - Image */}
                <div className="card-face card-front">
                  <div className="relative w-full aspect-[4/3] mb-4">
                    <Image
                      src={entry.imageUrl!}
                      alt={entry.original_text}
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                  <h3 className="font-medium text-gray-100">{entry.original_text}</h3>
                  <p className="text-sm text-gray-400">{entry.transcription}</p>
                  <p className="text-sm mt-1 text-gray-300">{entry.translation_text}</p>
                  <div className="mt-2 text-xs text-gray-500">Level {entry.level_id}</div>
                </div>
                
                {/* Back - Prompt */}
                <div className="card-face card-back">
                  <h3 className="font-medium mb-4 text-gray-100">Generated Prompt</h3>
                  <p className="text-sm leading-relaxed text-gray-300">
                    {entry.prompt}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(entry);
                    }}
                    className="btn-secondary mt-4 w-full"
                  >
                    <Download className="h-3 w-3" />
                    [DOWNLOAD]
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