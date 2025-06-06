import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // First, get all pending words
    const { data: words, error } = await supabaseAdmin
      .from('word_entries')
      .select('id, prompt')
      .neq('image_status', 'completed');
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch words' },
        { status: 500 }
      );
    }
    
    if (!words || words.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No pending words found' },
        { status: 404 }
      );
    }
    
    // Select a random word from the results
    const randomIndex = Math.floor(Math.random() * words.length);
    const randomWord = words[randomIndex];
    
    // Return only id and prompt
    return NextResponse.json({
      id: randomWord.id,
      prompt: randomWord.prompt
    });
    
  } catch (error) {
    console.error('Error fetching random pending word:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}