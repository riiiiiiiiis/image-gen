import { NextRequest, NextResponse } from 'next/server';
import { imageQueue } from '@/lib/imageQueue';
import { handleApiRequest } from '@/lib/apiUtils';

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const clearedCount = imageQueue.clearQueue();
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedCount} items from the image generation queue`,
      clearedCount
    });
  });
}