import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { handleApiRequest } from '@/lib/apiUtils';

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY is not set in environment variables',
        status: 'error' 
      }, { status: 500 });
    }
    
    const model = getGeminiModel();
    
    // Simple test prompt
    const testPrompt = 'Return a simple JSON object: {"test": "success", "number": 42}';
    
    console.log('Testing Gemini API...');
    
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.95,
        maxOutputTokens: 100,
      },
    });
    
    const result = response.response;
    const text = result.text().trim();
    
    console.log('Gemini test response:', text);
    
    return NextResponse.json({
      status: 'success',
      model: 'gemini-2.5-flash-preview-05-20',
      response: text,
      apiKeySet: true,
    });
  }, { parseBody: false });
}