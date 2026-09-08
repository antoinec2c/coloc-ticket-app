import { NextResponse } from 'next/server';
import { parseReceiptWithGemini } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileBase64, mimeType, apiKey, isDemo } = body;

    if (!isDemo && !fileBase64) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni pour l\'analyse' },
        { status: 400 }
      );
    }

    const receipt = await parseReceiptWithGemini(fileBase64 || '', mimeType || 'image/jpeg', apiKey, isDemo);

    return NextResponse.json(receipt);
  } catch (error: any) {
    console.error('Erreur API scan-receipt:', error);
    const msg = error?.message || 'Erreur lors de l\'analyse du ticket';
    const isNoKey = msg.includes('NO_API_KEY');

    return NextResponse.json(
      {
        error: isNoKey ? 'NO_API_KEY' : msg,
        message: msg.replace('NO_API_KEY: ', ''),
      },
      { status: isNoKey ? 401 : 500 }
    );
  }
}
