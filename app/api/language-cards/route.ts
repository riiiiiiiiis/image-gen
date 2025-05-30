import { NextRequest, NextResponse } from 'next/server';
import { languageCardRepository } from '@/lib/db/repository';
import { WordEntry } from '@/types';

export async function GET() {
  try {
    const entries = await languageCardRepository.findAll();
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching language cards:', error);
    return NextResponse.json({ error: 'Failed to fetch language cards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entries: WordEntry[] = await request.json();
    await languageCardRepository.bulkUpsert(entries);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving language cards:', error);
    return NextResponse.json({ error: 'Failed to save language cards' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, updates } = await request.json();
    await languageCardRepository.update(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating language card:', error);
    return NextResponse.json({ error: 'Failed to update language card' }, { status: 500 });
  }
}