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
    const { audioBase64, mimeType, apiKey: clientApiKey } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Données audio (base64) manquantes' },
        { status: 400 }
      );
    }

    const rawKey = clientApiKey || process.env.GEMINI_API_KEY || '';
    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API Gemini absente. Renseignez-la dans Paramètres (⚙️).' },
        { status: 500 }
      );
    }

    // Nettoyage rigoureux : retirer le préfixe data URL même avec paramètres (;codecs=opus) et les espaces
    const cleanBase64 = audioBase64.replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
    if (!cleanBase64) {
      return NextResponse.json({ text: '' });
    }

    // Retirer les paramètres du type MIME (ex: ;codecs=opus -> audio/webm ou audio/ogg)
    const pureMimeType = (mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
    ];

    let lastError: any = null;
    let rawText = '';

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
          },
        });

        const result = await model.generateContent([
          PROMPT_TRANSCRIBE,
          {
            inlineData: {
              data: cleanBase64,
              mimeType: pureMimeType,
            },
          },
        ]);

        rawText = result.response.text().trim();
        if (rawText !== undefined) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`Tentative transcription audio Gemini ${modelName} échouée:`, errMsg);
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('Overloaded')) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    if (!rawText && lastError) {
      throw lastError;
    }

    let text = rawText.trim();
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
    const rawMsg = String(error?.message || '');

    let userFacingMessage = "Impossible de transcrire cet enregistrement audio.";
    if (rawMsg.includes('API key') || rawMsg.includes('API_KEY_INVALID')) {
      userFacingMessage = "Clé API Gemini invalide ou expirée.";
    } else if (rawMsg.includes('credits are depleted') || rawMsg.includes('prepayment credits')) {
      userFacingMessage = "Crédits Google Gemini épuisés sur votre compte Google AI Studio.";
    } else if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('Service Unavailable') || rawMsg.includes('Overloaded')) {
      userFacingMessage = "Serveurs vocaux Google Gemini temporairement occupés (503). Réessayez dans un instant.";
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      userFacingMessage = "Quota de transcription vocale temporairement atteint. Réessayez dans une minute.";
    }

    return NextResponse.json(
      { error: userFacingMessage },
      { status: 500 }
    );
  }
}