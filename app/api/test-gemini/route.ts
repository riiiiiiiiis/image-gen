import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel, handleGeminiError } from '@/lib/gemini';

export async function GET() {
  try {
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
  } catch (error) {
    console.error('Gemini test error:', error);
    const errorInfo = handleGeminiError(error);
    
    return NextResponse.json({
      status: 'error',
      error: errorInfo.message,
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: errorInfo.status });
  }
}