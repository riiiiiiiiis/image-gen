import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    // Get random word where image_status != 'completed'
    const { data, error } = await supabaseAdmin
      .from('word_entries')
      .select('id, prompt')
      .neq('image_status', 'completed')
      .order('RANDOM()')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch random word' },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No pending words found' },
        { status: 404 }
      );
    }
    
    // Return only id and prompt
    return NextResponse.json({
      id: data.id,
      prompt: data.prompt
    });
    
  } catch (error) {
    console.error('Error fetching random pending word:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}