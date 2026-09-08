import { calculateBalances } from '../src/lib/balanceCalculator.js';
import { matchVoiceInstruction } from '../src/lib/voiceMatcher.js';

console.log('--- TEST 1 : Calcul des Soldes Tricount & Intégrité Coloc vs Perso ---');

const members = [
  { id: 'm1', name: 'Alex', avatar: '🥑', color: '#10b981' },
  { id: 'm2', name: 'Sam', avatar: '🦊', color: '#f59e0b' },
  { id: 'm3', name: 'Camille', avatar: '🎨', color: '#8b5cf6' },
];

const expenses = [
  {
    id: 'e1',
    title: 'Courses Carrefour',
    date: new Date().toISOString(),
    totalAmount: 50.0,
    colocAmount: 30.0, // 30€ partagés à 3 = 10€ chacun
    persoAmount: 20.0, // 20€ d'achats perso gardés par Alex
    payerId: 'm1', // Alex a payé
    payer: members[0],
    items: [],
  },
];

const { balances, debts, totalColocExpenses } = calculateBalances(members, expenses, []);

console.log('Total Coloc partagé :', totalColocExpenses, '€ (attendu: 30 €)');
balances.forEach((b) => {
  console.log(`- ${b.member.name} : Solde Net = ${b.netBalance} € (Payé coloc: ${b.totalPaid} €, Part: ${b.totalShare} €)`);
});

console.log('\nRemboursements suggérés :');
debts.forEach((d) => {
  console.log(`- ${d.from.name} doit rembourser ${d.amount} € à ${d.to.name}`);
});

console.log('\n--- TEST 2 : Mode Vocal "Coloc Flemmard" ---');

const sampleItems = [
  { id: '1', name: 'DOVE GEL DOUCHE MEN CARE', quantity: 1, unitPrice: 3.45, totalPrice: 3.45, isPersonal: false },
  { id: '2', name: 'BARILLA PATES PENNE 1KG', quantity: 2, unitPrice: 1.85, totalPrice: 3.70, isPersonal: false },
  { id: '3', name: 'KINDER BUENO X6', quantity: 1, unitPrice: 2.90, totalPrice: 2.90, isPersonal: false },
  { id: '4', name: 'LECLERC LAIT DEMI BIO 6L', quantity: 1, unitPrice: 6.80, totalPrice: 6.80, isPersonal: false },
];

const vocalTest1 = "Garde pour moi le gel douche et le kinder bueno, le reste c'est pour la coloc";
const result1 = matchVoiceInstruction(vocalTest1, sampleItems);
console.log('Phrase :', vocalTest1);
console.log('Résultat :', result1.explanation);
console.log('Articles matchés IDs :', result1.matchedItemIds, '(attendus: [1, 3])');

if (result1.matchedItemIds.includes('1') && result1.matchedItemIds.includes('3')) {
  console.log('✅ TEST VOCAL RÉUSSI !');
} else {
  console.error('❌ Échec du test vocal');
}
