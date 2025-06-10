import { NextRequest, NextResponse } from 'next/server';
import {
  callOpenRouter,
  formatOpenRouterBatchPromptMessages,
  BatchPromptEntry,
} from '@/lib/openrouter';
import { getPromptOverride } from '@/lib/promptOverrides';
import { handleApiRequest, validateRequestArray } from '@/lib/apiUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async (_req, body: { entries: BatchPromptEntry[] }) => {
    const validation = validateRequestArray(body.entries, 'entries');
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { entries } = body;

    // Fetch full data for all entries from the database
    const entryIds = entries.map(e => e.id);
    const { data: dbEntries, error: dbError } = await supabaseAdmin
      .from('word_entries')
      .select('*')
      .in('id', entryIds);

    if (dbError) {
      console.error('Failed to fetch entries from database:', dbError);
      return NextResponse.json({ error: 'Failed to fetch entries from database' }, { status: 500 });
    }

    // Create a map of DB entries for easy lookup - raw DB rows with snake_case column names
    interface DBEntry {
      id: number;
      categorization_transformation_needed: boolean;
      categorization_transformation_suggestion: string | null;
      [key: string]: unknown;
    }
    const dbEntriesMap = new Map<number, DBEntry>(dbEntries?.map((entry: DBEntry) => [entry.id, entry]) || []);

    // Check for overrides and DB suggestions, separating entries
    const finalResults: { id: number; prompt: string }[] = [];
    const entriesToGenerate: BatchPromptEntry[] = [];

    for (const entry of entries) {
      // Priority 1: Check for YAML override
      const override = getPromptOverride(entry.english);
      if (override) {
        console.log(`Using prompt override for "${entry.english}": "${override}"`);
        finalResults.push({ id: entry.id, prompt: override });
        continue;
      }

      // Priority 2: Need AI generation (always generate fresh prompts unless YAML override exists)
      entriesToGenerate.push(entry);
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

    // Combine all results (overrides and AI-generated), maintaining original order
    const allResults = [...finalResults, ...aiGeneratedResults];
    const sortedResults = allResults.sort((a, b) => a.id - b.id);

    return NextResponse.json({ prompts: sortedResults });
  });
}