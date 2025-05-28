import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { english, russian, transcription } = await request.json();

    if (!english || !russian || !transcription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-0520' });

    const prompt = `Generate a short, vivid scene description (50-100 words) featuring a character that conceptually embodies the word pair below. The scene should be simple, expressive, and suitable for emoji-style visualization. Focus on one clear character and action/emotion that helps memorize the word meaning.

English: ${english} ${transcription}
Russian: ${russian}

Create a memorable scene that connects the English word to its Russian meaning through visual storytelling.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ prompt: text });
  } catch (error: any) {
    console.error('Error generating prompt:', error);
    
    // Handle specific Gemini API errors
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('Invalid API key')) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your GEMINI_API_KEY in .env.local' },
        { status: 401 }
      );
    }
    
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      return NextResponse.json(
        { error: 'Gemini model not available. Using gemini-1.5-flash model.' },
        { status: 404 }
      );
    }
    
    if (error.message?.includes('RATE_LIMIT_EXCEEDED') || error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to generate prompt' },
      { status: 500 }
    );
  }
}