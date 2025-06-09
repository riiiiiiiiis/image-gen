import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel, formatSinglePrompt } from '@/lib/gemini';
import { getPromptOverride } from '@/lib/promptOverrides';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';
import { languageCardRepository } from '@/lib/db/repository';

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async (_req, body: { entryId: number; english: string; russian: string; transcription: string }) => {
    const validation = validateRequestBody(body, ['entryId', 'english', 'russian', 'transcription']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { entryId, english, russian, transcription } = body;

    // Check for prompt override first
    const override = getPromptOverride(english);
    if (override) {
      console.log(`Using prompt override for "${english}": "${override}"`);
      return NextResponse.json({ prompt: override });
    }

    // Check for existing transformation suggestion from categorization
    const wordEntry = await languageCardRepository.findById(entryId);
    if (wordEntry?.categorization) {
      const { transformation_needed, transformation_suggestion } = wordEntry.categorization;
      if (transformation_needed && transformation_suggestion && transformation_suggestion.trim() !== '') {
        console.log(`Using categorization transformation suggestion for "${english}": "${transformation_suggestion}"`);
        return NextResponse.json({ prompt: transformation_suggestion });
      }
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
    } catch {
      // If parsing fails, use the original text
      console.log('Failed to parse AI response as JSON, using raw text:', text);
    }

    return NextResponse.json({ prompt: finalPrompt });
  });
}