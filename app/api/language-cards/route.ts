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
  return handleApiRequest(request, async (_req, body: WordEntry[]) => {
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an array of entries' }, { status: 400 });
    }
    
    await languageCardRepository.bulkUpsert(body);
    return NextResponse.json({ success: true });
  });
}

export async function PATCH(request: NextRequest) {
  return handleApiRequest(request, async (_req, body: { id: number; updates: Partial<WordEntry> }) => {
    const validation = validateRequestBody(body, ['id', 'updates']);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    
    await languageCardRepository.update(body.id, body.updates);
    return NextResponse.json({ success: true });
  });
}