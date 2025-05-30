'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAppStore } from '@/store/useAppStore';
import { JSONImportData, WordEntry } from '@/types';
import { Upload, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { activityManager } from './ActivityLog';

export default function FileUpload() {
  const { setEntries } = useAppStore();

  const processJSONFile = (data: JSONImportData[]): WordEntry[] => {
    return data.map((item) => ({
      ...item,
      prompt: '',
      imageUrl: '',
      imageStatus: 'none',
      promptStatus: 'none',
      replicateId: '',
    }));
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const operationKey = `upload-${Date.now()}`;
    activityManager.addActivity('loading', `Processing ${file.name}...`, undefined, operationKey);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as JSONImportData[];

      // Validate JSON structure
      if (!Array.isArray(data)) {
        throw new Error('JSON must be an array');
      }

      const requiredFields = ['id', 'original_text', 'translation_text', 'level_id', 'transcription'];
      const invalidItems = data.filter((item, index) => {
        const missingFields = requiredFields.filter(field => !(field in item));
        if (missingFields.length > 0) {
          console.error(`Item at index ${index} missing fields:`, missingFields);
          return true;
        }
        return false;
      });

      if (invalidItems.length > 0) {
        throw new Error(`${invalidItems.length} items have missing required fields`);
      }

      const entries = processJSONFile(data);
      setEntries(entries);
      
      const levels = [...new Set(entries.map(e => e.level_id))].length;
      activityManager.addActivity('success', `Loaded ${entries.length} entries`, `${levels} difficulty levels found`, operationKey);
    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
      activityManager.addActivity('error', 'Failed to process file', errorMessage, operationKey);
    }
  }, [setEntries]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json']
    },
    maxFiles: 1
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-900 rounded-lg p-8 shadow-sm border border-gray-800">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-600 bg-blue-900/20' 
              : 'border-gray-700 hover:border-gray-600'
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 mb-4 text-gray-500" />
          
          {isDragActive ? (
            <p className="font-medium text-gray-300">Drop the JSON file here...</p>
          ) : (
            <>
              <p className="font-medium mb-2 text-gray-300">
                Drag and drop your JSON file here
              </p>
              <p className="text-sm text-gray-400">
                or click to select a file
              </p>
            </>
          )}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-gray-800 border border-gray-700">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-600" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-100">Expected JSON format</h3>
              <pre className="mt-2 text-xs overflow-x-auto text-gray-400">
{`[
  {
    "id": 11643,
    "original_text": "genius",
    "translation_text": "гений",
    "level_id": 70,
    "transcription": "[ˈʤiːnjəs]"
  }
]`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}