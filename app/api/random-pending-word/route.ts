import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Cache for total word count
let cachedTotalCount: number | null = null;
let lastCountUpdate: number = 0;
const COUNT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

async function getTotalWordCount(): Promise<number> {
  const now = Date.now();
  
  // If cache is still valid, return cached value
  if (cachedTotalCount !== null && (now - lastCountUpdate) < COUNT_CACHE_DURATION) {
    return cachedTotalCount;
  }
  
  // Otherwise, fetch fresh count
  try {
    const { count, error } = await supabaseAdmin
      .from('word_entries')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching total count:', error);
      // Fall back to previous cache or default
      return cachedTotalCount || 500;
    }
    
    // Update cache
    cachedTotalCount = count || 500;
    lastCountUpdate = now;
    console.log(`Updated total word count cache: ${cachedTotalCount}`);
    
    return cachedTotalCount;
  } catch (error) {
    console.error('Error in getTotalWordCount:', error);
    return cachedTotalCount || 500;
  }
}

export async function GET() {
  try {
    // Get total count (from cache or fresh)
    const totalCount = await getTotalWordCount();
    
    // Generate a random offset between 0 and totalCount - 1
    const randomOffset = Math.floor(Math.random() * totalCount);
    
    // Fetch a single word at the random offset
    // We get all fields to filter by status and get both texts
    const { data: words, error } = await supabaseAdmin
      .from('word_entries')
      .select('id, prompt, original_text, translation_text, image_status')
      .range(randomOffset, randomOffset + 10); // Get a few extra in case some are completed
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch word' },
        { status: 500 }
      );
    }
    
    // Find the first word that isn't completed
    const pendingWord = words?.find(word => word.image_status !== 'completed');
    
    if (!pendingWord) {
      // If no pending word found in this range, try a different approach
      // This is a fallback - fetch specifically pending words with limit
      const { data: fallbackWords, error: fallbackError } = await supabaseAdmin
        .from('word_entries')
        .select('id, prompt, original_text, translation_text')
        .neq('image_status', 'completed')
        .limit(1);
      
      if (fallbackError || !fallbackWords || fallbackWords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No pending words found' },
          { status: 404 }
        );
      }
      
      const word = fallbackWords[0];
      return NextResponse.json({
        id: word.id,
        prompt: word.prompt,
        original_text: word.original_text,
        translation_text: word.translation_text
      });
    }
    
    // Return id, prompt, and both text fields
    return NextResponse.json({
      id: pendingWord.id,
      prompt: pendingWord.prompt,
      original_text: pendingWord.original_text,
      translation_text: pendingWord.translation_text
    });
    
  } catch (error) {
    console.error('Error fetching random pending word:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}