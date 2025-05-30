import { NextResponse } from 'next/server';
import { getGeminiModel, formatBatchPrompt, handleGeminiError } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { entries } = await request.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid entries array' },
        { status: 400 }
      );
    }

    const model = getGeminiModel();
    const batchPrompt = formatBatchPrompt(entries);

    const result = await model.generateContent(batchPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw Gemini response:', text);

    // Parse the response
    let prompts;
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      prompts = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      console.error('Response text:', text);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!Array.isArray(prompts)) {
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    // Create a map for easy lookup
    const promptMap = new Map(prompts.map(p => [p.id, p.prompt]));
    
    // Build the response ensuring all requested entries have a prompt
    const results = entries.map(entry => ({
      id: entry.id,
      prompt: promptMap.get(entry.id) || 'Failed to generate prompt'
    }));

    return NextResponse.json({ prompts: results });
  } catch (error: any) {
    const errorInfo = handleGeminiError(error);
    return NextResponse.json(
      { error: errorInfo.message },
      { status: errorInfo.status }
    );
  }
}