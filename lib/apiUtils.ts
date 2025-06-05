import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler<T = any, U = any> = (request: NextRequest, body?: T) => Promise<NextResponse<U>>;

export interface ApiRequestOptions {
  parseBody?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }
    
    return await handler(request, body);
  } catch (err: unknown) {
    console.error(`API Error in ${request.url}:`, err);
    
    // If error is already a NextResponse, return it
    if (err instanceof Response) {
      return err as NextResponse<U | { error: string }>;
    }
    
    let status = 500;
    let message = 'Internal Server Error';
    const errorResponseJson: { error?: string } = {};

    if (typeof err === 'object' && err !== null) {
      if ('status' in err && typeof (err as { status: unknown }).status === 'number') {
        status = (err as { status: number }).status;
      }
      // Check for error.message first, then err.message
      if (err instanceof Error && err.message) {
        message = err.message;
      } else if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
        message = (err as { message: string }).message;
      }
      
      // Check for error.error (custom error object)
      if ('error' in err && typeof (err as { error: unknown }).error === 'string') {
        errorResponseJson.error = (err as { error: string }).error;
      }
    } else if (typeof err === 'string') {
      message = err;
    }
    
    // If error object has an explicit error field, use it
    if (errorResponseJson.error) {
      return NextResponse.json({ error: errorResponseJson.error }, { status });
    }
    
    return NextResponse.json({ error: message }, { status });
  }
}

// Validation utilities
export function validateRequestBody<T>(body: unknown, requiredFields: (keyof T)[]): { valid: boolean; error?: string; status?: number } {
  if (!body) {
    return { valid: false, error: 'Request body is missing.', status: 400 };
  }
  
  for (const field of requiredFields) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (body as any)[field];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return { valid: false, error: `Missing required field: ${String(field)}`, status: 400 };
    }
  }
  
  return { valid: true };
}

export function validateRequestArray(array: unknown, itemName: string = 'entries'): { valid: boolean; error?: string; status?: number } {
  if (!array || !Array.isArray(array)) {
    return { valid: false, error: `Missing or invalid "${itemName}" array.`, status: 400 };
  }
  
  if (array.length === 0) {
    return { valid: false, error: `"${itemName}" array cannot be empty.`, status: 400 };
  }
  
  return { valid: true };
}