import { NextResponse } from 'next/server';
import {
  callOpenRouter,
  handleOpenRouterError,
  formatOpenRouterBatchPromptMessages,
  BatchPromptEntry,
} from '@/lib/openrouter';

export async function POST(request: Request) {
  try {
    const { entries }: { entries: BatchPromptEntry[] } = await request.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid entries array' },
        { status: 400 }
      );
    }

    const messages = formatOpenRouterBatchPromptMessages(entries);

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

    const results = entries.map(entry => ({
      id: entry.id,
      prompt: promptMap.get(entry.id) || 'Failed to generate prompt',
    }));

    return NextResponse.json({ prompts: results });
  } catch (error: unknown) {
    const errorInfo = handleOpenRouterError(error);
    return NextResponse.json(
      { error: errorInfo.message },
      { status: errorInfo.status }
    );
  }
}