'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import Gallery from '@/components/Gallery';
import ASCIILogo from '@/components/ASCIILogo';
import QueueStatus from '@/components/QueueStatus';
import { FileText, Image } from 'lucide-react';

export default function Home() {
  const { entries, activeTab, setActiveTab, isInitialized } = useAppStore();
  const hasData = entries.length > 0;
  
  console.log('🏠 Page: Rendering with:', { 
    entriesCount: entries.length, 
    hasData, 
    activeTab, 
    isInitialized 
  });

  // Show loading state if store isn't initialized yet
  if (!isInitialized) {
    console.log('🔄 Page: Store not initialized, showing loading...');
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <ASCIILogo />
          </div>
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-center">
          <ASCIILogo />
        </div>
        
        {!hasData ? (
          <FileUpload />
        ) : (
          <>
            <div className="mb-6 bg-gray-900 rounded-lg shadow-sm border border-gray-800">
              <div className="border-b border-gray-800">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`
                      group inline-flex items-center px-6 py-4 text-sm font-medium transition-colors
                      ${activeTab === 'table' ? 'tab-active' : 'tab-inactive'}
                    `}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    [TABLE]
                  </button>
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className={`
                      group inline-flex items-center px-6 py-4 text-sm font-medium transition-colors
                      ${activeTab === 'gallery' ? 'tab-active' : 'tab-inactive'}
                    `}
                  >
                    <Image className="mr-2 h-4 w-4" />
                    [GALLERY]
                  </button>
                </nav>
              </div>
              
              <div className="p-6">
                {activeTab === 'table' ? <DataTable /> : <Gallery />}
              </div>
            </div>
          </>
        )}
      </main>
      
      {/* Queue Status - shows when there are items in queue */}
      <QueueStatus />
    </div>
  );
}
