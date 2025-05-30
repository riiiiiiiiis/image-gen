import { NextResponse } from 'next/server';
import { getGeminiModel, formatSinglePrompt, handleGeminiError } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { english, russian, transcription } = await request.json();

    if (!english || !russian || !transcription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const model = getGeminiModel();
    const prompt = formatSinglePrompt(english, russian, transcription);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ prompt: text });
  } catch (error: any) {
    const errorInfo = handleGeminiError(error);
    return NextResponse.json(
      { error: errorInfo.message },
      { status: errorInfo.status }
    );
  }
}