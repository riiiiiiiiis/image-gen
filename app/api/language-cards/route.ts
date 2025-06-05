import { NextRequest, NextResponse } from 'next/server';
import { languageCardRepository } from '@/lib/db/repository';
import { WordEntry } from '@/types';
import { handleApiRequest, validateRequestBody } from '@/lib/apiUtils';

export async function GET(request: NextRequest) {
  return handleApiRequest(request, async () => {
    const entries = await languageCardRepository.findAll();
    return NextResponse.json(entries);
  }, { parseBody: false });
}

export async function POST(request: NextRequest) {
  // @ts-expect-error - Need to use any for handleApiRequest compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleApiRequest(request, async (_req, body: any) => {
    const typedBody = body as WordEntry[];
    if (!Array.isArray(typedBody)) {
      return NextResponse.json({ error: 'Request body must be an array of entries' }, { status: 400 });
    }
    
    await languageCardRepository.bulkUpsert(typedBody);
    return NextResponse.json({ success: true });
  });
}

export async function PATCH(request: NextRequest) {
  // @ts-expect-error - Need to use any for handleApiRequest compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handleApiRequest(request, async (_req, body: any) => {
    const typedBody = body as { id: number; updates: Partial<WordEntry> };
    const validation = validateRequestBody(typedBody, ['id', 'updates']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    
    await languageCardRepository.update(typedBody.id, typedBody.updates);
    return NextResponse.json({ success: true });
  });
}