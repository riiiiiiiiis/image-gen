import { NextRequest, NextResponse } from 'next/server';

type ApiHandler<T = any, U = any> = (request: NextRequest, body?: T) => Promise<NextResponse<U>>;

export interface ApiRequestOptions {
  parseBody?: boolean;
}

export async function handleApiRequest<T = any, U = any>(
  request: NextRequest,
  handler: ApiHandler<T, U>,
  options: ApiRequestOptions = { parseBody: true }
): Promise<NextResponse<U | { error: string }>> {
  try {
    let body: T | undefined;
    
    if ((request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT') && options.parseBody) {
      try {
        body = await request.json();
      } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }
    
    return await handler(request, body);
  } catch (error: any) {
    console.error(`API Error in ${request.url}:`, error);
    
    // If error is already a NextResponse, return it
    if (error instanceof Response) {
      return error as NextResponse;
    }
    
    // Extract status and message from error if available
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';
    
    // If error object has an explicit error field, use it
    if (error.error) {
      return NextResponse.json({ error: error.error }, { status });
    }
    
    return NextResponse.json({ error: message }, { status });
  }
}

// Validation utilities
export function validateRequestBody<T>(body: any, requiredFields: (keyof T)[]): { valid: boolean; error?: string; status?: number } {
  if (!body) {
    return { valid: false, error: 'Request body is missing.', status: 400 };
  }
  
  for (const field of requiredFields) {
    const value = body[field];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return { valid: false, error: `Missing required field: ${String(field)}`, status: 400 };
    }
  }
  
  return { valid: true };
}

export function validateRequestArray<T>(array: any, itemName: string = 'entries'): { valid: boolean; error?: string; status?: number } {
  if (!array || !Array.isArray(array)) {
    return { valid: false, error: `Missing or invalid "${itemName}" array.`, status: 400 };
  }
  
  if (array.length === 0) {
    return { valid: false, error: `"${itemName}" array cannot be empty.`, status: 400 };
  }
  
  return { valid: true };
}