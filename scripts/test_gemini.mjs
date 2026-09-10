import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = (process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
console.log("Using API key prefix:", apiKey.slice(0, 8), "len:", apiKey.length);
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
  ];

  for (const modelName of candidateModels) {
    try {
      console.log(`Testing model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent('Bonjour, reponds en un seul mot: Pret');
      console.log(`SUCCÈS avec le modèle "${modelName}" ! Réponse:`, res.response.text().trim());
      return modelName;
    } catch (err) {
      console.log(`Échec pour ${modelName}:`, err.message);
    }
  }
}

run();

