import { NextResponse } from 'next/server';
import { matchVoiceInstruction } from '@/lib/voiceMatcher';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript, items } = body;

    if (!transcript || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Transcription et liste des articles requis' },
        { status: 400 }
      );
    }

    const result = matchVoiceInstruction(transcript, items);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erreur API voice-match:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse vocale' },
      { status: 500 }
    );
  }
}
