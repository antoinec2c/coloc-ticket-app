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
    const rawMsg = String(error?.message || '');
    const isNoKey = rawMsg.includes('NO_API_KEY') || rawMsg.includes('API key not valid') || rawMsg.includes('API_KEY_INVALID');

    let userFacingMessage = "Impossible de déchiffrer ce ticket. Assurez-vous qu'il est bien net et éclairé, ou saisissez les articles manuellement.";
    if (isNoKey) {
      userFacingMessage = "Clé API Gemini absente ou invalide. Renseignez-la dans les Paramètres (⚙️) ou contactez l'administrateur.";
    } else if (rawMsg.includes('credits are depleted') || rawMsg.includes('prepayment credits')) {
      userFacingMessage = "Vos crédits Google Gemini sont épuisés sur Google AI Studio. Rechargez vos crédits ou générez une clé gratuite sur aistudio.google.com et renseignez-la dans Paramètres (⚙️).";
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      userFacingMessage = "Quota de requêtes Gemini temporairement atteint. Veuillez patienter une minute avant de réessayer.";
    } else if (rawMsg.includes('SAFETY') || rawMsg.includes('BLOCKED')) {
      userFacingMessage = "L'image du ticket a été filtrée par les règles de sécurité. Essayez une autre photo.";
    }

    return NextResponse.json(
      {
        error: isNoKey ? 'NO_API_KEY' : 'SCAN_FAILED',
        message: userFacingMessage,
      },
      { status: isNoKey ? 401 : 500 }
    );
  }
}

