import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PROMPT_TRANSCRIBE = `Tu es un assistant de transcription vocale en français ultra-fidèle pour une application de courses en colocation.
Transcris TRÈS EXACTEMENT ce qui est dit dans cet enregistrement audio court.
RÈGLES IMPÉRATIVES :
- Renvoie UNIQUEMENT le texte prononcé en français.
- Ne rajoute AUCUN commentaire, AUCUN guillemet, AUCUNE salutation, AUCUNE ponctuation d'encadrement.
- Conserve fidèlement les noms de marques et de produits (ex: "gel douche", "chips", "kinder bueno", "coca", "pâtes", etc.).
- Si l'enregistrement ne contient que du silence, du souffle ou aucun mot reconnaissable, renvoie STRICTEMENT une chaîne vide "".`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { audioBase64, mimeType } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Données audio (base64) manquantes' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'Clé API Gemini absente du serveur (.env.local)' },
        { status: 500 }
      );
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleanBase64) {
      return NextResponse.json({ text: '' });
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        temperature: 0.1,
      },
    });

    const result = await model.generateContent([
      PROMPT_TRANSCRIBE,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'audio/webm',
        },
      },
    ]);

    let text = result.response.text().trim();
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith('«') && text.endsWith('»'))
    ) {
      text = text.slice(1, -1).trim();
    }

    if (text.toLowerCase() === 'vide' || text.toLowerCase() === 'silence') {
      text = '';
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Erreur API transcribe-audio:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la transcription audio' },
      { status: 500 }
    );
  }
}