'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

interface QueueStatus {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  isProcessing: boolean;
}

export default function QueueStatus() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/queue-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setIsVisible(data.total > 0);
      }
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible || !status) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-lg min-w-64 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-100">Image Queue</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-300"
        >
          ×
        </button>
      </div>

      <div className="space-y-2">
        {status.pending > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3 text-yellow-500" />
            <span className="text-gray-300">Pending: {status.pending}</span>
          </div>
        )}

        {status.processing > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Loader className="h-3 w-3 text-blue-500 animate-spin" />
            <span className="text-gray-300">Processing: {status.processing}</span>
          </div>
        )}

        {status.completed > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-gray-300">Completed: {status.completed}</span>
          </div>
        )}

        {status.errors > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <XCircle className="h-3 w-3 text-red-500" />
            <span className="text-gray-300">Errors: {status.errors}</span>
          </div>
        )}

        <div className="pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            Total: {status.total} {status.isProcessing ? '(Active)' : '(Idle)'}
          </div>
        </div>
      </div>
    </div>
  );
}