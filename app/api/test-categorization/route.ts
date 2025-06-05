import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { handleApiRequest } from '@/lib/apiUtils';

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const testWords = [
      { id: 1, original_text: 'a, an', translation_text: 'неопределенный артикль', level_id: 66 },
      { id: 2, original_text: 'about', translation_text: 'о, около, приблизительно, почти', level_id: 66 }
    ];
    
    const model = getGeminiModel();
    const results = [];
    
    for (const word of testWords) {
      const prompt = `Categorize "${word.original_text}" (${word.translation_text}) for emoji image generation.

Return JSON:
{
  "primary_category": "CONCRETE-VISUAL" or "ABSTRACT-SYMBOLIC" or "ACTION-VISUAL" or "STATE-METAPHORICAL",
  "image_suitability": "HIGH" or "MEDIUM" or "LOW",
  "word_type": "noun" or "verb" or "adjective" or "adverb" or "phrase",
  "transformation_needed": true or false,
  "transformation_suggestion": "",
  "confidence": 0.9
}`;

      try {
        console.log(`Testing categorization for "${word.original_text}"`);
        
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
          },
          thinkingConfig: {
            includeThoughts: false,
          },
        });
        
        const result = response.response;
        const text = result.text().trim();
        
        console.log(`Response for "${word.original_text}":`, text);
        console.log('Usage metadata:', result.usageMetadata);
        
        results.push({
          word: word.original_text,
          success: true,
          response: text,
          usage: result.usageMetadata
        });
      } catch (error) {
        console.error(`Error for "${word.original_text}":`, error);
        results.push({
          word: word.original_text,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({ results });
  }, { parseBody: false });
}