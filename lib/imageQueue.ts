import Replicate from 'replicate';
import { getReplicateModel, createReplicateInput } from './replicateConfig';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

interface QueueItem {
  id: string;
  entryId: number;
  englishWord: string;
  prompt: string;
  predictionId?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  retries: number;
  createdAt: Date;
}

class ImageGenerationQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxRetries = 3;
  private concurrentLimit = 1; // Process one at a time to avoid rate limits
  private processingCount = 0;

  // Add item to queue
  async addToQueue(entryId: number, englishWord: string, prompt: string): Promise<string> {
    // Check if this entry is already in queue
    const existingItem = this.queue.find(item => item.entryId === entryId);
    if (existingItem) {
      console.log(`Entry ${entryId} (${englishWord}) already in queue with status: ${existingItem.status}`);
      return existingItem.id;
    }

    const queueId = `queue-${Date.now()}-${entryId}`;
    const item: QueueItem = {
      id: queueId,
      entryId,
      englishWord,
      prompt,
      status: 'pending',
      retries: 0,
      createdAt: new Date(),
    };

    this.queue.push(item);
    console.log(`Added to queue: ${englishWord} (${queueId}) - Total queue: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return queueId;
  }

  // Start processing queue
  private async startProcessing() {
    if (this.processing) {
      console.log('Processing already running, skipping...');
      return;
    }
    
    this.processing = true;
    console.log(`Starting image queue processing... Total items: ${this.queue.length}`);

    while (this.queue.length > 0) {
      const pendingItems = this.queue.filter(item => item.status === 'pending');
      console.log(`Queue status: Total=${this.queue.length}, Pending=${pendingItems.length}`);
      
      const item = pendingItems[0]; // Get first pending item
      if (!item) {
        console.log('No pending items, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      console.log(`Processing next item: ${item.englishWord} (${item.id})`);
      
      // Process one item at a time (sequential processing)
      await this.processItem(item);
      
      // Small delay between items to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.processing = false;
    console.log('Queue processing finished - no more items');
  }

  // Process individual item
  private async processItem(item: QueueItem) {
    while (item.status === 'pending' && item.retries < this.maxRetries) {
      try {
        console.log(`Processing: ${item.englishWord} (${item.id}) - Attempt ${item.retries + 1}`);
        item.status = 'processing';

        // Create prediction (async) using centralized config
        const prediction = await replicate.predictions.create({
          version: getReplicateModel(),
          input: createReplicateInput(item.prompt),
        });

        item.predictionId = prediction.id;
        console.log(`Created prediction: ${prediction.id} for ${item.englishWord}`);

        // Wait for completion
        const result = await replicate.wait(prediction);
        
        if (result.status === 'succeeded' && result.output) {
          await this.handleSuccess(item, result.output);
          return; // Success - exit the retry loop
        } else {
          throw new Error(`Prediction failed: ${result.error || 'Unknown error'}`);
        }

      } catch (error) {
        console.error(`Attempt ${item.retries + 1} failed for ${item.englishWord}:`, error);
        item.retries++;
        
        if (item.retries < this.maxRetries) {
          console.log(`Retrying ${item.englishWord} (attempt ${item.retries + 1}/${this.maxRetries}) after delay`);
          item.status = 'pending';
          // Add delay before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 5000 * item.retries));
        } else {
          console.error(`Max retries reached for ${item.englishWord} (${item.id})`);
          item.status = 'error';
          
          // Notify error
          this.notifyError(item, (error as Error).message || 'Generation failed');
          
          // Remove from queue
          this.removeFromQueue(item.id);
          return; // Exit retry loop
        }
      }
    }
  }

  // Handle successful generation
  private async handleSuccess(item: QueueItem, output: any) {
    try {
      console.log(`Success: ${item.englishWord} (${item.id})`);
      
      // Get image URL from output
      let imageUrl: string;
      if (Array.isArray(output) && output.length > 0) {
        const fileOutput = output[0] as any;
        imageUrl = fileOutput.url ? fileOutput.url().toString() : fileOutput.toString();
      } else {
        throw new Error('Invalid output format');
      }

      // Download and save image
      const downloadResult = await this.downloadAndSaveImage(imageUrl, item.entryId);
      
      item.status = 'completed';
      
      // Notify completion via callback or event
      this.notifyCompletion(item, {
        imageUrl: downloadResult.localImageUrl,
        originalUrl: imageUrl,
        generatedAt: new Date().toISOString(),
      });

      // Remove from queue
      this.removeFromQueue(item.id);

    } catch (error) {
      console.error(`Error processing success for ${item.englishWord}:`, error);
      throw error; // Re-throw to be handled by processItem
    }
  }


  // Download and save image locally
  private async downloadAndSaveImage(imageUrl: string, entryId: number) {
    const fs = require('fs');
    const path = require('path');

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);
    
    // Create images directory if it doesn't exist
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Use entry ID as filename - simple and unique
    const filename = `${entryId}.png`;
    const filepath = path.join(imagesDir, filename);
    
    // Save file
    fs.writeFileSync(filepath, buffer);
    
    // Return local URL with cache buster
    const timestamp = Date.now();
    const localImageUrl = `/images/${filename}?t=${timestamp}`;
    
    return { localImageUrl, filepath, filename };
  }

  // Remove item from queue
  private removeFromQueue(queueId: string) {
    const index = this.queue.findIndex(item => item.id === queueId);
    if (index > -1) {
      const item = this.queue[index];
      this.queue.splice(index, 1);
      console.log(`Removed from queue: ${item.englishWord} (${queueId}) - Remaining: ${this.queue.length}`);
    } else {
      console.log(`Item not found in queue for removal: ${queueId}`);
    }
  }

  // Get queue status
  getQueueStatus() {
    const status = {
      total: this.queue.length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      processing: this.queue.filter(item => item.status === 'processing').length,
      completed: this.queue.filter(item => item.status === 'completed').length,
      errors: this.queue.filter(item => item.status === 'error').length,
      isProcessing: this.processing,
    };
    
    // Debug logging
    console.log('Queue status requested:', status);
    console.log('Queue contents:', this.queue.map(item => ({
      id: item.id,
      entryId: item.entryId,
      word: item.englishWord,
      status: item.status,
      retries: item.retries
    })));
    
    return status;
  }

  // Get queue items
  getQueueItems() {
    return this.queue.map(item => ({
      id: item.id,
      entryId: item.entryId,
      englishWord: item.englishWord,
      status: item.status,
      retries: item.retries,
      createdAt: item.createdAt,
      predictionId: item.predictionId,
    }));
  }

  // Callback methods (to be overridden)
  protected notifyCompletion(item: QueueItem, result: any) {
    // Override this method to handle completion
    console.log(`✅ Completed: ${item.englishWord}`);
  }

  protected notifyError(item: QueueItem, error: string) {
    // Override this method to handle errors
    console.log(`❌ Error: ${item.englishWord} - ${error}`);
  }

  protected notifyProgress(item: QueueItem, status: string) {
    // Override this method to handle progress updates
    console.log(`🔄 Progress: ${item.englishWord} - ${status}`);
  }
}

// Export singleton instance
export const imageQueue = new ImageGenerationQueue();
export type { QueueItem };