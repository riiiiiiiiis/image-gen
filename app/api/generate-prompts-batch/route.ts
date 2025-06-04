import { NextResponse } from 'next/server';
import {
  callOpenRouter,
  handleOpenRouterError,
  formatOpenRouterBatchPromptMessages,
  BatchPromptEntry,
} from '@/lib/openrouter';
import { getPromptOverride } from '@/lib/promptOverrides';

export async function POST(request: Request) {
  try {
    const { entries }: { entries: BatchPromptEntry[] } = await request.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid entries array' },
        { status: 400 }
      );
    }

    // Check for overrides first and separate entries
    const overriddenResults: { id: number; prompt: string }[] = [];
    const entriesToGenerate: BatchPromptEntry[] = [];

    for (const entry of entries) {
      const override = getPromptOverride(entry.english);
      if (override) {
        console.log(`Using prompt override for "${entry.english}": "${override}"`);
        overriddenResults.push({ id: entry.id, prompt: override });
      } else {
        entriesToGenerate.push(entry);
      }
    }

    let aiGeneratedResults: { id: number; prompt: string }[] = [];

    // Only call AI for entries without overrides
    if (entriesToGenerate.length > 0) {
      const messages = formatOpenRouterBatchPromptMessages(entriesToGenerate);
      const rawResponseContent = await callOpenRouter(messages);

      console.log('Raw OpenRouter response content:', rawResponseContent);

      // The content from callOpenRouter should be a stringified JSON if response_format is json_object
      const responseText = typeof rawResponseContent === 'string' ? rawResponseContent : JSON.stringify(rawResponseContent);

      let prompts;
      try {
        // Remove any markdown code blocks if present (good safeguard)
        const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        prompts = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse OpenRouter response:', parseError);
        console.error('Response text from AI:', responseText);
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        );
      }

      if (!Array.isArray(prompts)) {
        console.error('Invalid response format from AI. Expected array, got:', prompts);
        return NextResponse.json(
          { error: 'Invalid response format from AI' },
          { status: 500 }
        );
      }

      const promptMap = new Map(prompts.map((p: { id: number; prompt?: string; single_object?: string }) => [
        p.id, 
        p.prompt || p.single_object || 'Failed to generate prompt'
      ]));

      aiGeneratedResults = entriesToGenerate.map(entry => ({
        id: entry.id,
        prompt: promptMap.get(entry.id) || 'Failed to generate prompt',
      }));
    }

    // Combine overridden and AI-generated results, maintaining original order
    const allResults = [...overriddenResults, ...aiGeneratedResults];
    const sortedResults = allResults.sort((a, b) => a.id - b.id);

    return NextResponse.json({ prompts: sortedResults });
  } catch (error: unknown) {
    const errorInfo = handleOpenRouterError(error);
    return NextResponse.json(
      { error: errorInfo.message },
      { status: errorInfo.status }
    );
  }
}