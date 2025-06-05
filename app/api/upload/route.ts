import { NextResponse } from 'next/server';
import { uploadFileToBlob } from '@/lib/vercelBlobUpload';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  try {
    // Construct a unique filename, e.g., using entryId or a timestamp if not available from client
    // For now, using original file.name, but for programmatic uploads, you'll generate this.
    const fileName = `uploads/${Date.now()}-${file.name}`;
    const url = await uploadFileToBlob(fileName, file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 });
  }
}