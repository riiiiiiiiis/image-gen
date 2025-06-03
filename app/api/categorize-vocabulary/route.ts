import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter, handleOpenRouterError } from '@/lib/openrouter';
import { languageCardRepository } from '@/lib/db/repository';
import { CategorizationResult } from '@/types';

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
- For polysemous words, identify primary meaning
- Suggest transformation strategy if abstract

Output JSON only, matching this exact structure with valid values:
{
  "primary_category": "CONCRETE-VISUAL" | "ABSTRACT-SYMBOLIC" | "ACTION-VISUAL" | "STATE-METAPHORICAL",
  "image_suitability": "HIGH" | "MEDIUM" | "LOW",
  "word_type": "noun" | "verb" | "adjective" | "adverb" | "phrase",
  "transformation_needed": boolean, // e.g., true or false
  "transformation_suggestion": "string", // e.g., "represent 'happiness' with a smiling emoji face" or "" if not needed
  "confidence": number // 0.0-1.0
}

Example of a valid JSON output:
{
  "primary_category": "ABSTRACT-SYMBOLIC",
  "image_suitability": "MEDIUM",
  "word_type": "noun",
  "transformation_needed": true,
  "transformation_suggestion": "Visualize as an idea lightbulb",
  "confidence": 0.85
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
    if (!categorization.primary_category || !categorization.image_suitability || !categorization.word_type) {
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
  try {
    const body = await request.json() as CategorizeRequest;
    
    // Validate request
    if (!body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json({ error: 'Invalid request: entries must be an array' }, { status: 400 });
    }
    
    if (body.entries.length === 0) {
      return NextResponse.json({ error: 'Invalid request: entries array is empty' }, { status: 400 });
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
          error: error instanceof Error ? error.message : 'Unknown error',
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
  } catch (error) {
    console.error('=== CATEGORIZATION API ERROR ===');
    console.error('Categorization API error:', error);
    console.error('API Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack',
    });
    console.error('=== END CATEGORIZATION API ERROR ===');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to categorize vocabulary' },
      { status: 500 }
    );
  }
}