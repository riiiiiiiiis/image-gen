import { WordEntry } from '@/types';
import { ApiResponse } from './apiClient';
import { activityManager } from '@/components/ActivityLog';

export interface BatchProcessorConfig<TPayload, TResult, TError> {
  itemsToProcess: WordEntry[];
  batchSize: number;
  delayBetweenBatchesMs: number;
  operationName: string;
  getBatchPayload: (batch: WordEntry[]) => TPayload;
  batchApiService: (payload: TPayload) => Promise<ApiResponse<any>>;
  getSuccessItems: (responseData: any) => TResult[];
  getErrorItems: (responseData: any) => TError[];
  processItemSuccess: (itemResult: TResult, originalEntry: WordEntry) => void;
  processItemError: (itemError: TError, originalEntry?: WordEntry) => void;
  onStartProcessingItem?: (entry: WordEntry) => void;
}

export interface BatchProcessorResult {
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
}

export async function processBatch<TPayload, TResult extends { id: number }, TError extends { id?: number }>(
  config: BatchProcessorConfig<TPayload, TResult, TError>
): Promise<BatchProcessorResult> {
  const {
    itemsToProcess,
    batchSize,
    delayBetweenBatchesMs,
    operationName,
    getBatchPayload,
    batchApiService,
    getSuccessItems,
    getErrorItems,
    processItemSuccess,
    processItemError,
    onStartProcessingItem
  } = config;
  const operationKey = `batch-${operationName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  activityManager.addActivity(operationKey, `Starting ${operationName}...`, 'info');

  const batches = [];
  for (let i = 0; i < itemsToProcess.length; i += batchSize) {
    batches.push(itemsToProcess.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;

    if (onStartProcessingItem) {
      batch.forEach(entry => onStartProcessingItem(entry));
    }

    activityManager.addActivity(
      `${operationKey}-batch-${batchNumber}`,
      `Processing batch ${batchNumber} of ${batches.length} (${batch.length} items)...`,
      'info'
    );

    try {
      const payload = getBatchPayload(batch);
      const response = await batchApiService(payload);

      if (response.error) {
        activityManager.addActivity(
          `${operationKey}-batch-${batchNumber}-error`,
          `Batch ${batchNumber} failed: ${response.error}`,
          'error'
        );
        
        batch.forEach(entry => {
          processItemError({ id: entry.id } as TError, entry);
          totalFailed++;
        });
      } else if (response.data) {
        const successItems = getSuccessItems(response.data);
        const errorItems = getErrorItems(response.data);

        successItems.forEach(result => {
          const originalEntry = batch.find(entry => entry.id === result.id);
          if (originalEntry) {
            processItemSuccess(result, originalEntry);
            totalSuccess++;
          }
        });

        errorItems.forEach(error => {
          const originalEntry = error.id ? batch.find(entry => entry.id === error.id) : undefined;
          processItemError(error, originalEntry);
          totalFailed++;
          
          if (error.id && 'error' in error) {
            const errorMessage = (error as any).error;
            const entryText = originalEntry ? `Word "${originalEntry.original_text}" (ID: ${error.id})` : `Item ${error.id}`;
            activityManager.addActivity(
              `${operationKey}-item-${error.id}-error`,
              `${entryText} failed: ${errorMessage}`,
              'error'
            );
          }
        });

        activityManager.addActivity(
          `${operationKey}-batch-${batchNumber}-complete`,
          `Batch ${batchNumber} completed: ${successItems.length} successful, ${errorItems.length} failed`,
          'success'
        );
      }

      totalProcessed += batch.length;

      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatchesMs));
      }
    } catch (error) {
      activityManager.addActivity(
        `${operationKey}-batch-${batchNumber}-exception`,
        `Batch ${batchNumber} encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
      
      batch.forEach(entry => {
        processItemError({ id: entry.id } as TError, entry);
        totalFailed++;
      });
      
      totalProcessed += batch.length;
    }
  }

  activityManager.addActivity(
    `${operationKey}-complete`,
    `${operationName} completed: ${totalSuccess} successful, ${totalFailed} failed out of ${totalProcessed} processed`,
    totalFailed === 0 ? 'success' : 'warning'
  );

  return {
    totalProcessed,
    totalSuccess,
    totalFailed
  };
}