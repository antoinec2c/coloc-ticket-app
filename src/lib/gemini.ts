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
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

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
      console.warn(`Tentative modèle Gemini ${modelName} échouée:`, err.message || err);
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

  parsed.items = (parsed.items || []).map((item) => ({
    ...item,
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || Number(item.totalPrice) || 0,
    totalPrice: Number(item.totalPrice) || 0,
    isPersonal: false,
    category: item.category || 'Alimentation',
  }));

  if (!parsed.total) {
    parsed.total = parsed.items.reduce((acc, it) => acc + it.totalPrice, 0);
  }
  parsed.total = Math.round(parsed.total * 100) / 100;

  return parsed;
}
