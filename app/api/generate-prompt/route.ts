import { NextResponse } from 'next/server';
import { getGeminiModel, formatSinglePrompt, handleGeminiError } from '@/lib/gemini';
import { getPromptOverride } from '@/lib/promptOverrides';

export async function POST(request: Request) {
  try {
    const { english, russian, transcription } = await request.json();

    if (!english || !russian || !transcription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check for prompt override first
    const override = getPromptOverride(english);
    if (override) {
      console.log(`Using prompt override for "${english}": "${override}"`);
      return NextResponse.json({ prompt: override });
    }

    // Fall back to AI generation
    const model = getGeminiModel();
    const prompt = formatSinglePrompt(english, russian, transcription);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the response to extract just the description
    let finalPrompt = text;
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      finalPrompt = parsed.prompt || parsed.single_object || text;
    } catch (parseError) {
      // If parsing fails, use the original text
      console.log('Failed to parse AI response as JSON, using raw text:', text);
    }

    return NextResponse.json({ prompt: finalPrompt });
  } catch (error: any) {
    const errorInfo = handleGeminiError(error);
    return NextResponse.json(
      { error: errorInfo.message },
      { status: errorInfo.status }
    );
  }
}