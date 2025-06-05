import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel, formatSinglePrompt } from '@/lib/gemini';
import { getPromptOverride } from '@/lib/promptOverrides';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';

export async function POST(request: NextRequest) {
  // @ts-expect-error - Complex return type that doesn't fit generic constraints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleApiRequest(request, async (_req, body: any) => {
    const typedBody = body as { english: string; russian: string; transcription: string };
    const validation = validateRequestBody(typedBody, ['english', 'russian', 'transcription']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { english, russian, transcription } = typedBody;

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
    } catch {
      // If parsing fails, use the original text
      console.log('Failed to parse AI response as JSON, using raw text:', text);
    }

    return NextResponse.json({ prompt: finalPrompt });
  });
}