import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedReceipt } from '@/types';

// Prompt ultra-court et direct pour une exécution ultra-rapide (< 1.5s)
const PROMPT_FAST_EXTRACTION = `Analyse ce ticket de caisse français (courses ou facture).
Renvoie UNIQUEMENT un JSON strict avec ce schéma :
{
  "store": "Nom magasin",
  "date": "AAAA-MM-JJ",
  "total": 0.0,
  "items": [
    { "name": "Nom article", "quantity": 1, "unitPrice": 0.0, "totalPrice": 0.0, "category": "Alimentation" }
  ]
}
Extrais tous les articles, quantités, prix unitaires et totaux. Déduis les remises éventuelles.`;

const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function parseReceiptWithGemini(
  fileBase64: string,
  mimeType: string,
  apiKey?: string,
  isDemo?: boolean
): Promise<ExtractedReceipt> {
  const rawKey = apiKey || process.env.GEMINI_API_KEY || '';
  const key = rawKey.replace(/^["']|["']$/g, '').trim();

  if (!key) {
    throw new Error("NO_API_KEY: Clé API Gemini absente.");
  }

  const genAI = new GoogleGenerativeAI(key);

  // Nettoyer rigoureusement le base64 (retirer tout préfixe data:..., les paramètres type codecs, et les espaces/retours chariot)
  const cleanBase64 = fileBase64.replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
  if (!cleanBase64) {
    throw new Error("Contenu de l'image vide ou corrompu.");
  }

  // Normaliser le type MIME (retirer d'éventuels paramètres comme ;charset=utf-8)
  const pureMimeType = (mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';

  let lastError: any = null;
  let responseText = '';

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent([
        PROMPT_FAST_EXTRACTION,
        {
          inlineData: {
            data: cleanBase64,
            mimeType: pureMimeType,
          },
        },
      ]);

      responseText = result.response.text();
      if (responseText) {
        break; // Succès avec ce modèle
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`Tentative modèle Gemini ${modelName} échouée:`, errMsg);
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('Overloaded')) {
        await sleep(600);
      }
    }
  }

  if (!responseText) {
    throw lastError || new Error("Impossible de lire les données du ticket.");
  }

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Format de réponse IA invalide (JSON introuvable).");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ExtractedReceipt;

  parsed.items = (parsed.items || []).map((item) => {
    const qty = Number(item.quantity) || 1;
    const totPrice =
      typeof item.totalPrice === 'number' && item.totalPrice > 0
        ? Math.round(item.totalPrice * 100) / 100
        : typeof item.unitPrice === 'number' && item.unitPrice > 0
        ? Math.round(item.unitPrice * qty * 100) / 100
        : 0;

    const uPrice =
      typeof item.unitPrice === 'number' && item.unitPrice > 0
        ? Math.round(item.unitPrice * 100) / 100
        : qty > 0 && totPrice > 0
        ? Math.round((totPrice / qty) * 100) / 100
        : totPrice;

    return {
      ...item,
      name: item.name || 'Article',
      quantity: qty,
      unitPrice: uPrice,
      totalPrice: totPrice,
      isPersonal: false,
      category: item.category || 'Alimentation',
    };
  });

  if (!parsed.total) {
    parsed.total = parsed.items.reduce((acc, it) => acc + it.totalPrice, 0);
  }
  parsed.total = Math.round(parsed.total * 100) / 100;

  return parsed;
}
