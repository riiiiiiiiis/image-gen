import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, handleOpenRouterError } from '@/lib/openrouter';
import { languageCardRepository } from '@/lib/db/repository';
import { CategorizationResult } from '@/types';
import { handleApiRequest, validateRequestArray } from '@/lib/apiUtils';

export const maxDuration = 60; // 60 seconds timeout

interface CategorizeRequest {
  entries: Array<{
    id: number;
    original_text: string;
    translation_text: string;
    level_id: number;
  }>;
}

interface CategorizeResponse {
  results: Array<{
    id: number;
    categorization: CategorizationResult;
  }>;
  errors: Array<{
    id: number;
    error: string;
  }>;
}

function createCategorizationPrompt(entry: CategorizeRequest['entries'][0]): string {
  return `Categorize the following vocabulary word for image generation suitability.
Word: ${entry.original_text}
Translation: ${entry.translation_text}
Context: English language learning, level ${entry.level_id}

Analyze and categorize based on:
- Concrete/Abstract nature
- Visual representation potential (HIGH/MEDIUM/LOW)
- Word type (noun/verb/adjective/adverb/phrase)
- Suggest a direct, ready-to-use image prompt if the word is abstract or needs transformation.

Output JSON only, matching this exact structure:
{
  "primary_category": "CONCRETE-VISUAL" | "ABSTRACT-SYMBOLIC" | "ACTION-VISUAL" | "STATE-METAPHORICAL",
  "image_suitability": "HIGH" | "MEDIUM" | "LOW",
  "word_type": "noun" | "verb" | "adjective" | "adverb" | "phrase",
  "transformation_needed": boolean,
  "transformation_suggestion": "string", // CRITICAL: This MUST be a direct image prompt, NOT an explanation.
  "confidence": number
}

"transformation_suggestion" RULES:
- If transformation is NOT needed, leave this as an empty string "".
- If transformation IS needed, provide a concise, direct image prompt (max 4 words).
- DO NOT use phrases like "Represent with...", "Visualize as...", "Show a...".
- The suggestion itself should NOT contain the word "emoji". The system adds that context later.
- The suggestion should be a concrete noun or a person-centric action.

GOOD Example ("happiness"):
{
  ...
  "transformation_suggestion": "smiling face" // Correct: no "emoji" word.
}

BAD Example ("happiness"):
{
  ...
  "transformation_suggestion": "smiling emoji face" // WRONG! Contains the word "emoji".
}

GOOD Example ("above"):
{
  ...
  "transformation_suggestion": "person pointing up"
}

BAD Example ("above"):
{
  ...
  "transformation_suggestion": "An image showing a person pointing up" // WRONG! Conversational.
}`;
}

async function categorizeEntry(entry: CategorizeRequest['entries'][0]): Promise<CategorizationResult> {
  const prompt = createCategorizationPrompt(entry);
  
  try {
    console.log(`Sending categorization request for "${entry.original_text}"`);
    console.log('Using OpenRouter with model:', process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-preview-05-20');
    
    const response = await callOpenRouter([
      {
        role: 'system',
        content: 'You are a helpful assistant that categorizes vocabulary words for image generation suitability. Output only valid JSON. No explanations.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.1,
      max_tokens: 8192,
      response_format: { type: 'json_object' }
    });
    
    console.log(`OpenRouter response for "${entry.original_text}":`, response);
    
    // Parse the response
    let jsonText = response.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\s*/g, '').trim();
    }
    
    // Extract JSON object if there's extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    jsonText = jsonMatch ? jsonMatch[0] : jsonText;
    
    console.log(`[Categorization] Attempting to parse JSON for entry ID ${entry.id}:`, jsonText);
    let categorization: CategorizationResult;
    try {
      categorization = JSON.parse(jsonText) as CategorizationResult;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed to parse text:', jsonText);
      console.error('Original response text:', response);
      throw new Error(`JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
    console.log(`[Categorization] Successfully parsed categorization for entry ID ${entry.id}:`, categorization);
    
    // Validate the response structure
    if (!categorization.primary_category || !categorization.image_suitability || categorization.word_type === undefined) {
      throw new Error('Invalid categorization response structure');
    }
    
    // Ensure boolean type for transformation_needed
    categorization.transformation_needed = Boolean(categorization.transformation_needed);
    
    // Ensure string type for transformation_suggestion
    categorization.transformation_suggestion = categorization.transformation_suggestion || '';
    
    // Ensure confidence is a number between 0 and 1
    categorization.confidence = Math.max(0, Math.min(1, Number(categorization.confidence) || 0.5));
    
    return categorization;
  } catch (error) {
    console.error(`[Categorization] Failed to categorize entry ID: ${entry.id}, Word: "${entry.original_text}". Error:`, error);
    
    // Use the OpenRouter error handler for better error messages
    const errorInfo = handleOpenRouterError(error);
    console.error('Handled error info:', errorInfo);
    throw new Error(errorInfo.message);
  }
}

export async function POST(request: NextRequest) {
  return handleApiRequest(request, async (_req, body: CategorizeRequest) => {
    // Validate request
    const validation = validateRequestArray(body.entries, 'entries');
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    
    if (body.entries.length > 10) {
      return NextResponse.json({ error: 'Invalid request: maximum 10 entries allowed per batch' }, { status: 400 });
    }
    
    const response: CategorizeResponse = {
      results: [],
      errors: [],
    };
    
    // Process entries in parallel
    const promises = body.entries.map(async (entry) => {
      try {
        // Update status to processing
        await languageCardRepository.update(entry.id, {
          categorizationStatus: 'processing',
        });
        
        // Categorize the entry
        const categorization = await categorizeEntry(entry);
        console.log(`Successfully categorized entry ${entry.id}:`, categorization);
        
        // Save categorization to database
        await languageCardRepository.update(entry.id, {
          categorization,
          categorizationStatus: 'completed',
        });
        
        response.results.push({
          id: entry.id,
          categorization,
        });
        console.log(`Added to results array. Current results length: ${response.results.length}`);
      } catch (error) {
        console.error(`=== ENTRY ${entry.id} ERROR ===`);
        console.error(`Failed to categorize entry ${entry.id}:`, error);
        console.error(`Entry details:`, {
          id: entry.id,
          original_text: entry.original_text,
          translation_text: entry.translation_text,
          level_id: entry.level_id
        });
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : 'No stack',
        });
        console.error(`=== END ENTRY ${entry.id} ERROR ===`);
        
        // Update status to error
        await languageCardRepository.update(entry.id, {
          categorizationStatus: 'error',
        });
        
        response.errors.push({
          id: entry.id,
          error: `Word "${entry.original_text}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    });
    
    await Promise.all(promises);
    
    console.log('Final response being sent:', {
      resultsCount: response.results.length,
      errorsCount: response.errors.length,
      results: response.results,
      errors: response.errors
    });
    
    return NextResponse.json(response);
  });
}