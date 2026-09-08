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

export async function parseReceiptWithGemini(
  fileBase64: string,
  mimeType: string,
  apiKey?: string,
  isDemo?: boolean
): Promise<ExtractedReceipt> {
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key || key.trim() === '') {
    throw new Error("Clé API Gemini absente du serveur (.env.local).");
  }

  const genAI = new GoogleGenerativeAI(key.trim());
  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');

  // Modèle ultra-rapide
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
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
        mimeType: mimeType || 'image/jpeg',
      },
    },
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Impossible de lire les données du ticket.");
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
