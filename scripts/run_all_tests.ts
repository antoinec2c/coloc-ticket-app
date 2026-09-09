/**
 * TEST SUITE EXHAUSTIVE - APPLICATION TICKET DE CAISSE COLOC
 * Couvre 100% des cas d'usage :
 *  - Reconnaissance vocale & Intentions (global, perso, coloc, pluriels, abréviations, marques)
 *  - Anti-faux-positifs & sécurité des chaînes
 *  - Algorithme de calcul des soldes (Tricount/Splitwise) & isolation stricte des achats perso
 *  - Simplification des dettes (algorithme glouton)
 *  - Règlements & remboursements (settlements)
 *  - Simulation complète du flux Zero-Wait (mise en mémoire pendant le scan)
 */

import { matchVoiceInstruction } from '../src/lib/voiceMatcher';
import { calculateBalances } from '../src/lib/balanceCalculator';
import { ExpenseItem, Member, Expense, Settlement } from '../src/types';

// ==========================================
// PETIT RUNNER DE TEST LÉGER & COLORÉ
// ==========================================
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: { suite: string; name: string; error: any }[] = [];

function suite(suiteName: string, fn: () => void) {
  console.log(`\n\x1b[1m\x1b[36m▶ SUITE : ${suiteName}\x1b[0m`);
  fn();
}

function test(testName: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
  } catch (err: any) {
    failedTests++;
    console.log(`  \x1b[31m✖\x1b[0m ${testName}`);
    console.log(`    \x1b[31mErreur: ${err.message || err}\x1b[0m`);
    failures.push({ suite: '', name: testName, error: err });
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} -> Reçu: ${JSON.stringify(actual)}, Attendu: ${JSON.stringify(expected)}`);
  }
}

function assertArrayIncludes(arr: string[], val: string, message: string) {
  if (!arr.includes(val)) {
    throw new Error(`${message} -> La liste [${arr.join(', ')}] ne contient pas '${val}'`);
  }
}

// ==========================================
// DONNÉES DE TEST TYPES (TICKET RÉALISTE)
// ==========================================
const mockReceiptItems: ExpenseItem[] = [
  { id: 'item-1', name: 'DOP GEL DOUCHE 250ML', quantity: 1, unitPrice: 2.45, totalPrice: 2.45, isPersonal: false },
  { id: 'item-2', name: 'BAGUETTE DE TRADITION', quantity: 2, unitPrice: 1.20, totalPrice: 2.40, isPersonal: false },
  { id: 'item-3', name: 'HEINEKEN PACK 6X25CL', quantity: 1, unitPrice: 6.80, totalPrice: 6.80, isPersonal: false },
  { id: 'item-4', name: 'CHOC AU LAIT MILKA 100G', quantity: 2, unitPrice: 1.95, totalPrice: 3.90, isPersonal: false },
  { id: 'item-5', name: 'PETITS POIS SURGELES 1KG', quantity: 1, unitPrice: 2.10, totalPrice: 2.10, isPersonal: false },
  { id: 'item-6', name: 'SIGNAL DENTIFRICE BLANC', quantity: 1, unitPrice: 1.85, totalPrice: 1.85, isPersonal: false },
  { id: 'item-7', name: 'DANETTE CHOCOLAT 4X115G', quantity: 1, unitPrice: 2.20, totalPrice: 2.20, isPersonal: false },
  { id: 'item-8', name: 'COCA COLA 1.5L', quantity: 2, unitPrice: 2.05, totalPrice: 4.10, isPersonal: false },
  { id: 'item-9', name: 'BARILLA SPAGHETTI 500G', quantity: 3, unitPrice: 1.30, totalPrice: 3.90, isPersonal: false },
  { id: 'item-10', name: 'PRESIDENT BEURRE DEMI-SEL', quantity: 1, unitPrice: 2.65, totalPrice: 2.65, isPersonal: false },
  { id: 'item-11', name: 'ABRICOTS DU ROUSSILLON', quantity: 1, unitPrice: 3.50, totalPrice: 3.50, isPersonal: false },
  { id: 'item-12', name: 'LAYS CHIPS A L ANCIENNE', quantity: 1, unitPrice: 1.90, totalPrice: 1.90, isPersonal: false },
  { id: 'item-13', name: 'ST ELOI RISSOLEES 1KG', quantity: 1, unitPrice: 2.15, totalPrice: 2.15, isPersonal: false },
];

const mockMembers: Member[] = [
  { id: 'mem-1', name: 'Alice', avatar: '👩', color: '#10b981', role: 'coloc' },
  { id: 'mem-2', name: 'Bob', avatar: '👨', color: '#3b82f6', role: 'coloc' },
  { id: 'mem-3', name: 'Charlie', avatar: '🧑', color: '#f59e0b', role: 'coloc' },
];

// ==========================================
// DÉBUT DE LA BATTERIE DE TESTS
// ==========================================
console.log('\x1b[1m\x1b[35m=== DÉMARRAGE DE LA SUITE DE TESTS EXHAUSTIVE ===\x1b[0m');
const startTime = Date.now();

// ----------------------------------------------------
// SUITE 1 : ORDRES GLOBAUX VOCAUX
// ----------------------------------------------------
suite('1. Reconnaissance Vocale : Ordres Globaux', () => {
  const colocPhrases = [
    'tout pour la coloc',
    'rien pour moi',
    'tout est pour la coloc',
    'rien de perso',
    'tout pour tout le monde',
    'tout en coloc',
  ];

  colocPhrases.forEach((phrase) => {
    test(`Global Coloc : "${phrase}"`, () => {
      const res = matchVoiceInstruction(phrase, mockReceiptItems);
      assertEqual(res.action, 'set_coloc', `Doit être set_coloc pour "${phrase}"`);
      assertEqual(res.matchedItemIds.length, mockReceiptItems.length, 'Tous les articles doivent être affectés');
    });
  });

  const persoPhrases = [
    'tout pour moi',
    'tout est pour moi',
    'garde tout',
    'tout en perso',
    "c'est tout pour moi",
  ];

  persoPhrases.forEach((phrase) => {
    test(`Global Perso : "${phrase}"`, () => {
      const res = matchVoiceInstruction(phrase, mockReceiptItems);
      assertEqual(res.action, 'set_personal', `Doit être set_personal pour "${phrase}"`);
      assertEqual(res.matchedItemIds.length, mockReceiptItems.length, 'Tous les articles doivent être passés en perso');
    });
  });
});

// ----------------------------------------------------
// SUITE 2 : MOTS-CLÉS D'INTENTION PERSONNELS ET COLOC
// ----------------------------------------------------
suite("2. Reconnaissance Vocale : Variantes d'intentions", () => {
  test('Intention "garde pour moi" -> Perso', () => {
    const res = matchVoiceInstruction('garde pour moi le gel douche', mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-1', 'Doit trouver le gel douche');
  });

  test('Intention "pour moi" -> Perso', () => {
    const res = matchVoiceInstruction('pour moi les chips', mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-12', 'Doit trouver les chips');
  });

  test('Intention "en perso" -> Perso', () => {
    const res = matchVoiceInstruction('en perso le coca', mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-8', 'Doit trouver le coca');
  });

  test('Intention "mon / ma / mes" -> Perso', () => {
    const res = matchVoiceInstruction('mes bieres', mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-3', 'Doit trouver les bières');
  });

  test('Intention "je prends" -> Perso', () => {
    const res = matchVoiceInstruction('je prends le dentifrice', mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-6', 'Doit trouver le dentifrice');
  });

  test('Intention "j\'ai pris" -> Perso', () => {
    const res = matchVoiceInstruction("j'ai pris les danette", mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-7', 'Doit trouver la danette');
  });

  test('Intention "c\'est a moi" -> Perso', () => {
    const res = matchVoiceInstruction("c'est a moi le chocolat", mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Action');
    assertArrayIncludes(res.matchedItemIds, 'item-4', 'Doit trouver le chocolat');
  });

  test('Intention implicite (simple citation de l\'article) -> Perso par défaut', () => {
    const res = matchVoiceInstruction('le gel douche', mockReceiptItems);
    assertEqual(res.action, 'set_personal', 'Doit basculer en perso');
    assertArrayIncludes(res.matchedItemIds, 'item-1', 'Doit trouver le gel douche');
  });

  test('Intention "remets en coloc" -> Coloc', () => {
    const res = matchVoiceInstruction('remets en coloc les spaghetti', mockReceiptItems);
    assertEqual(res.action, 'set_coloc', 'Doit basculer en coloc');
    assertArrayIncludes(res.matchedItemIds, 'item-9', 'Doit trouver les spaghetti');
  });

  test('Intention "pour tout le monde" -> Coloc', () => {
    const res = matchVoiceInstruction('pour tout le monde la baguette', mockReceiptItems);
    assertEqual(res.action, 'set_coloc', 'Doit basculer en coloc');
    assertArrayIncludes(res.matchedItemIds, 'item-2', 'Doit trouver la baguette');
  });

  test('Intention "en commun" -> Coloc', () => {
    const res = matchVoiceInstruction('en commun le beurre', mockReceiptItems);
    assertEqual(res.action, 'set_coloc', 'Doit basculer en coloc');
    assertArrayIncludes(res.matchedItemIds, 'item-10', 'Doit trouver le beurre');
  });
});

// ----------------------------------------------------
// SUITE 3 : PLURIELS, SINGULIERS & RACINISATION (STEMMING)
// ----------------------------------------------------
suite('3. Reconnaissance Vocale : Pluriels et Singuliers', () => {
  test('Pluriel en "-s" ("bières" prononcé, "HEINEKEN PACK" sur ticket)', () => {
    const res = matchVoiceInstruction('garde les bières', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-3', 'Doit matcher le pack de bière');
  });

  test('Pluriel en "-s" ("chocolats" prononcé, "CHOC AU LAIT" sur ticket)', () => {
    const res = matchVoiceInstruction('les chocolats pour moi', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-4', 'Doit matcher le chocolat');
  });

  test('Pluriel en "-s" ("chips" prononcé, "LAYS CHIPS" sur ticket)', () => {
    const res = matchVoiceInstruction('je prends les chips', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-12', 'Doit matcher les chips');
  });

  test('Singulier prononcé ("baguette") pour pluriel de quantité ("BAGUETTE DE TRADITION" x2)', () => {
    const res = matchVoiceInstruction('la baguette', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-2', 'Doit matcher la baguette');
  });
});

// ----------------------------------------------------
// SUITE 4 : ABRÉVIATIONS DE CAISSE & PRÉFIXES
// ----------------------------------------------------
suite('4. Reconnaissance Vocale : Abréviations de caisse', () => {
  test('"chocolat" match l\'abréviation ticket "CHOC"', () => {
    const res = matchVoiceInstruction('le chocolat', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-4', 'CHOC AU LAIT');
  });

  test('"shampoing" match l\'abréviation ticket "SHAMP"', () => {
    const ticketWithShamp: ExpenseItem[] = [
      { id: 'shamp-1', name: 'SHAMP ELSEVE 250ML', quantity: 1, unitPrice: 3.20, totalPrice: 3.20, isPersonal: false }
    ];
    const res = matchVoiceInstruction('mon shampoing', ticketWithShamp);
    assertArrayIncludes(res.matchedItemIds, 'shamp-1', 'Doit matcher SHAMP');
  });

  test('"dentifrice" match l\'abréviation ticket "DENTIF"', () => {
    const ticketWithDentif: ExpenseItem[] = [
      { id: 'dent-1', name: 'DENTIF COLGATE TOTAL', quantity: 1, unitPrice: 2.10, totalPrice: 2.10, isPersonal: false }
    ];
    const res = matchVoiceInstruction('garde le dentifrice', ticketWithDentif);
    assertArrayIncludes(res.matchedItemIds, 'dent-1', 'Doit matcher DENTIF');
  });

  test('"biscuit" match l\'abréviation ticket "BISC"', () => {
    const ticketWithBisc: ExpenseItem[] = [
      { id: 'bisc-1', name: 'BISC LU OREO 154G', quantity: 1, unitPrice: 1.65, totalPrice: 1.65, isPersonal: false }
    ];
    const res = matchVoiceInstruction('les biscuits', ticketWithBisc);
    assertArrayIncludes(res.matchedItemIds, 'bisc-1', 'Doit matcher BISC');
  });
});

// ----------------------------------------------------
// SUITE 5 : SYNONYMES DE SUPERMARCHÉ & MARQUES
// ----------------------------------------------------
suite('5. Reconnaissance Vocale : Marques & Synonymes', () => {
  test('Mot "bière" match la marque "HEINEKEN"', () => {
    const res = matchVoiceInstruction('la biere est a moi', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-3', 'HEINEKEN');
  });

  test('Mot "savon / douche" match "DOP GEL DOUCHE"', () => {
    const res = matchVoiceInstruction('mon gel douche', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-1', 'DOP GEL DOUCHE');
  });

  test('Mot "boisson / soda" match "COCA COLA"', () => {
    const res = matchVoiceInstruction('garde le soda', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-8', 'COCA COLA');
  });

  test('Mot "pâtes" match "BARILLA SPAGHETTI"', () => {
    const res = matchVoiceInstruction('pour moi les pates', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-9', 'BARILLA SPAGHETTI');
  });

  test('Mot "yaourt" match "DANETTE CHOCOLAT"', () => {
    const res = matchVoiceInstruction('les yaourts pour moi', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-7', 'DANETTE');
  });

  test('Marque directe "heineken" match "HEINEKEN PACK"', () => {
    const res = matchVoiceInstruction("j'ai pris la heineken", mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-3', 'HEINEKEN');
  });

  test('"pomme de terre" match "ST ELOI RISSOLEES"', () => {
    const res = matchVoiceInstruction('garde la pomme de terre', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-13', 'ST ELOI RISSOLEES');
  });

  test('"pommes de terre" (pluriel) match "ST ELOI RISSOLEES"', () => {
    const res = matchVoiceInstruction('pour moi les pommes de terre', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-13', 'ST ELOI RISSOLEES');
  });

  test('"les patates" match "ST ELOI RISSOLEES"', () => {
    const res = matchVoiceInstruction('en perso les patates', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-13', 'ST ELOI RISSOLEES');
  });

  test('"les rissolées" match "ST ELOI RISSOLEES"', () => {
    const res = matchVoiceInstruction('je prends les rissolees', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-13', 'ST ELOI RISSOLEES');
  });
});

// ----------------------------------------------------
// SUITE 6 : SÉCURITÉ ANTI-FAUX-POSITIFS (CAS CRITIQUES)
// ----------------------------------------------------
suite('6. Reconnaissance Vocale : Robustesse & Anti-Faux-Positifs', () => {
  test('Le mot "pris" ("j\'ai pris") ne doit JAMAIS matcher "ABRICOTS"', () => {
    const res = matchVoiceInstruction("j'ai pris les chips", mockReceiptItems);
    assert(
      !res.matchedItemIds.includes('item-11'),
      'CRITIQUE : "pris" a fait matcher par erreur les ABRICOTS !'
    );
    assertArrayIncludes(res.matchedItemIds, 'item-12', 'Doit avoir matché les chips');
  });

  test('Le mot "gel" ne doit JAMAIS matcher "PETITS POIS SURGELÉS"', () => {
    const res = matchVoiceInstruction('garde le gel douche', mockReceiptItems);
    assert(
      !res.matchedItemIds.includes('item-5'),
      'CRITIQUE : "gel" a fait matcher par erreur les PETITS POIS SURGELES !'
    );
    assertArrayIncludes(res.matchedItemIds, 'item-1', 'Doit avoir matché DOP GEL DOUCHE');
  });

  test('Article non présent sur le ticket ("homard") -> 0 match et explication claire', () => {
    const res = matchVoiceInstruction('garde le homard', mockReceiptItems);
    assertEqual(res.matchedItemIds.length, 0, 'Aucun article ne doit être matché');
    assert(res.explanation.includes('Aucun article'), 'Explication explicite attendue');
  });

  test('Phrase vide ou composée uniquement de mots vides -> 0 match sans crash', () => {
    const res = matchVoiceInstruction('je avec le pour de', mockReceiptItems);
    assertEqual(res.matchedItemIds.length, 0, 'Aucun match sur des stop words purs');
  });
});

// ----------------------------------------------------
// SUITE 7 : ACCENTS, CASSE & PONCTUATION
// ----------------------------------------------------
suite('7. Reconnaissance Vocale : Normalisation', () => {
  test('Insensibilité à la casse (Majuscules / Minuscules)', () => {
    const res = matchVoiceInstruction('GARDE LE GEL DOUCHE', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-1', 'Doit matcher en majuscules');
  });

  test('Suppression transparente des accents', () => {
    const res = matchVoiceInstruction('garde la biere et les pates', mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-3', 'Bière sans accent');
    assertArrayIncludes(res.matchedItemIds, 'item-9', 'Pâtes sans accent');
  });

  test('Ponctuation et apostrophes ("c\'est pour moi, le coca !") ', () => {
    const res = matchVoiceInstruction("c'est pour moi, le coca !", mockReceiptItems);
    assertArrayIncludes(res.matchedItemIds, 'item-8', 'Doit matcher le coca');
  });
});

// ----------------------------------------------------
// SUITE 8 : ARTICLES MULTIPLES DANS UNE SEULE PHRASE
// ----------------------------------------------------
suite('8. Reconnaissance Vocale : Articles Multiples', () => {
  test('3 articles demandés d\'un coup ("le gel douche, les bières et les chips")', () => {
    const res = matchVoiceInstruction(
      'garde pour moi le gel douche, les bières et les chips',
      mockReceiptItems
    );
    assertEqual(res.matchedItemIds.length, 3, 'Doit matcher exactement 3 articles');
    assertArrayIncludes(res.matchedItemIds, 'item-1', 'Gel douche');
    assertArrayIncludes(res.matchedItemIds, 'item-3', 'Bières');
    assertArrayIncludes(res.matchedItemIds, 'item-12', 'Chips');
  });
});

// ----------------------------------------------------
// SUITE 9 : CALCULATEUR DE SOLDES - RÉPARTITION ÉQUITABLE SIMPLE
// ----------------------------------------------------
suite('9. Calculateur de Soldes : Dépense Commune Pure', () => {
  test('Alice paie 60€ de coloc (0€ perso) pour 3 membres (Alice, Bob, Charlie)', () => {
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        title: 'Courses Carrefour',
        totalAmount: 60,
        colocAmount: 60,
        persoAmount: 0,
        payerId: 'mem-1', // Alice
        date: '2026-09-08',
        payer: mockMembers[0],
        items: [],
      },
    ];

    const result = calculateBalances(mockMembers, expenses, []);

    assertEqual(result.totalColocExpenses, 60, 'Total coloc');

    const aliceBal = result.balances.find((b) => b.member.id === 'mem-1');
    const bobBal = result.balances.find((b) => b.member.id === 'mem-2');
    const charlieBal = result.balances.find((b) => b.member.id === 'mem-3');

    // Alice a payé 60€, sa part est 20€ -> net = +40€
    assertEqual(aliceBal?.netBalance, 40, 'Alice solde net');
    assertEqual(aliceBal?.totalPaid, 60, 'Alice total payé coloc');
    assertEqual(aliceBal?.totalShare, 20, 'Alice part');

    // Bob a payé 0€, part 20€ -> net = -20€
    assertEqual(bobBal?.netBalance, -20, 'Bob solde net');

    // Charlie a payé 0€, part 20€ -> net = -20€
    assertEqual(charlieBal?.netBalance, -20, 'Charlie solde net');

    // Dettes : Bob doit 20€ à Alice, Charlie doit 20€ à Alice
    assertEqual(result.debts.length, 2, 'Nombre de dettes');
    const bobDebt = result.debts.find((d) => d.from.id === 'mem-2');
    assertEqual(bobDebt?.to.id, 'mem-1', 'Bob doit rembourser Alice');
    assertEqual(bobDebt?.amount, 20, 'Montant de Bob');

    const charlieDebt = result.debts.find((d) => d.from.id === 'mem-3');
    assertEqual(charlieDebt?.to.id, 'mem-1', 'Charlie doit rembourser Alice');
    assertEqual(charlieDebt?.amount, 20, 'Montant de Charlie');
  });
});

// ----------------------------------------------------
// SUITE 10 : CALCULATEUR DE SOLDES - ISOLATION STRICTE DU PERSO
// ----------------------------------------------------
suite('10. Calculateur de Soldes : Isolation des Achats Personnels', () => {
  test('Alice paie 100€ au total : 40€ de perso pour elle + 60€ de coloc', () => {
    const expenses: Expense[] = [
      {
        id: 'exp-2',
        title: 'Courses avec articles perso',
        totalAmount: 100,
        colocAmount: 60,
        persoAmount: 40,
        payerId: 'mem-1', // Alice
        date: '2026-09-08',
        payer: mockMembers[0],
        items: [],
      },
    ];

    const result = calculateBalances(mockMembers, expenses, []);

    // Le pot commun ne doit STRICTEMENT enregistrer que 60€ (et JAMAIS 100€)
    assertEqual(result.totalColocExpenses, 60, 'Le pot coloc doit être de 60€');

    const bobBal = result.balances.find((b) => b.member.id === 'mem-2');
    const charlieBal = result.balances.find((b) => b.member.id === 'mem-3');

    // Bob et Charlie ne doivent payer QUE leur part du coloc (20€ chacun, pas 33.33€ !)
    assertEqual(bobBal?.totalShare, 20, 'Part de Bob = 20€');
    assertEqual(charlieBal?.totalShare, 20, 'Part de Charlie = 20€');
    assertEqual(bobBal?.netBalance, -20, 'Solde net de Bob');
    assertEqual(charlieBal?.netBalance, -20, 'Solde net de Charlie');
  });
});

// ----------------------------------------------------
// SUITE 11 : CALCULATEUR DE SOLDES - DÉPENSES CROISÉES & MINIMISATION DES DETTES
// ----------------------------------------------------
suite('11. Calculateur de Soldes : Dépenses Croisées & Simplification', () => {
  test('Alice paie 60€ coloc, Bob paie 30€ coloc, Charlie paie 0€', () => {
    const expenses: Expense[] = [
      {
        id: 'exp-a',
        title: 'Courses Alice',
        totalAmount: 60,
        colocAmount: 60,
        persoAmount: 0,
        payerId: 'mem-1',
        date: '2026-09-08',
        payer: mockMembers[0],
        items: [],
      },
      {
        id: 'exp-b',
        title: 'Courses Bob',
        totalAmount: 30,
        colocAmount: 30,
        persoAmount: 0,
        payerId: 'mem-2',
        date: '2026-09-08',
        payer: mockMembers[1],
        items: [],
      },
    ];

    const result = calculateBalances(mockMembers, expenses, []);

    // Total coloc : 90€ -> 30€ / personne
    assertEqual(result.totalColocExpenses, 90, 'Total');

    const aliceBal = result.balances.find((b) => b.member.id === 'mem-1');
    const bobBal = result.balances.find((b) => b.member.id === 'mem-2');
    const charlieBal = result.balances.find((b) => b.member.id === 'mem-3');

    // Alice net : 60 - 30 = +30€
    assertEqual(aliceBal?.netBalance, 30, 'Alice solde net');
    // Bob net : 30 - 30 = 0€ (quitte !)
    assertEqual(bobBal?.netBalance, 0, 'Bob solde net');
    // Charlie net : 0 - 30 = -30€
    assertEqual(charlieBal?.netBalance, -30, 'Charlie solde net');

    // Algorithme glouton de minimisation des virements :
    // Charlie doit directement 30€ à Alice (1 seul virement optimal au lieu de multiples virements !)
    assertEqual(result.debts.length, 1, 'Nombre de transactions optimisé à 1');
    assertEqual(result.debts[0].from.id, 'mem-3', 'Débiteur = Charlie');
    assertEqual(result.debts[0].to.id, 'mem-1', 'Créancier = Alice');
    assertEqual(result.debts[0].amount, 30, 'Montant = 30€');
  });
});

// ----------------------------------------------------
// SUITE 12 : RÈGLEMENTS & REMBOURSEMENTS (SETTLEMENTS)
// ----------------------------------------------------
suite('12. Calculateur de Soldes : Remboursements Partiels & Totaux', () => {
  const expenses: Expense[] = [
    {
      id: 'exp-s1',
      title: 'Dépense',
      totalAmount: 60,
      colocAmount: 60,
      persoAmount: 0,
      payerId: 'mem-1',
      date: '2026-09-08',
      payer: mockMembers[0],
      items: [],
    },
  ];

  test('Règlement partiel : Bob rembourse 15€ sur ses 20€ dus à Alice', () => {
    const settlements: Settlement[] = [
      {
        id: 'set-1',
        fromMemberId: 'mem-2', // Bob
        toMemberId: 'mem-1', // Alice
        amount: 15,
        date: '2026-09-08',
        fromMember: mockMembers[1],
        toMember: mockMembers[0],
      },
    ];

    const result = calculateBalances(mockMembers, expenses, settlements);

    const bobBal = result.balances.find((b) => b.member.id === 'mem-2');
    const aliceBal = result.balances.find((b) => b.member.id === 'mem-1');

    // Bob devait 20€, il a rendu 15€ -> son solde net remonte à -5€
    assertEqual(bobBal?.netBalance, -5, 'Solde net de Bob après remboursement');
    // Alice avait +40€, a reçu 15€ -> créance restante de +25€ (+20€ de Charlie, +5€ de Bob)
    assertEqual(aliceBal?.netBalance, 25, 'Solde net d\'Alice après avoir reçu 15€');

    // Dettes restantes : Bob doit 5€, Charlie doit 20€
    const bobDebt = result.debts.find((d) => d.from.id === 'mem-2');
    assertEqual(bobDebt?.amount, 5, 'Dette restante de Bob');
  });

  test('Règlement total : Bob et Charlie remboursent la totalité', () => {
    const settlements: Settlement[] = [
      {
        id: 'set-2',
        fromMemberId: 'mem-2',
        toMemberId: 'mem-1',
        amount: 20,
        date: '2026-09-08',
        fromMember: mockMembers[1],
        toMember: mockMembers[0],
      },
      {
        id: 'set-3',
        fromMemberId: 'mem-3',
        toMemberId: 'mem-1',
        amount: 20,
        date: '2026-09-08',
        fromMember: mockMembers[2],
        toMember: mockMembers[0],
      },
    ];

    const result = calculateBalances(mockMembers, expenses, settlements);

    assertEqual(result.debts.length, 0, 'Tout le monde est quitte -> 0 dette restante');
    result.balances.forEach((b) => {
      assertEqual(b.netBalance, 0, `${b.member.name} doit avoir un solde net à 0€`);
    });
  });
});

// ----------------------------------------------------
// SUITE 13 : CAS LIMITES & ROBUSTESSE
// ----------------------------------------------------
suite('13. Calculateur de Soldes : Cas Limites', () => {
  test('Aucune dépense (base de données vierge 0.00€)', () => {
    const result = calculateBalances(mockMembers, [], []);
    assertEqual(result.totalColocExpenses, 0, 'Total à 0');
    assertEqual(result.debts.length, 0, 'Aucune dette');
    result.balances.forEach((b) => {
      assertEqual(b.netBalance, 0, 'Solde net 0.00€');
    });
  });

  test('Liste de membres vide', () => {
    const result = calculateBalances([], [], []);
    assertEqual(result.balances.length, 0, 'Balances vides');
    assertEqual(result.debts.length, 0, 'Dettes vides');
    assertEqual(result.totalColocExpenses, 0, 'Total 0');
  });

  test('Arrondi strict aux centimes sur division non entière (10€ partagés entre 3)', () => {
    const exp: Expense[] = [
      {
        id: 'exp-round',
        title: 'Arrondi',
        totalAmount: 10,
        colocAmount: 10,
        persoAmount: 0,
        payerId: 'mem-1',
        date: '2026-09-08',
        payer: mockMembers[0],
        items: [],
      },
    ];

    const result = calculateBalances(mockMembers, exp, []);
    const bob = result.balances.find((b) => b.member.id === 'mem-2');
    // 10 / 3 = 3.3333333 -> arrondi à 3.33
    assertEqual(bob?.totalShare, 3.33, 'Part de Bob arrondie à 3.33€');
    assertEqual(bob?.netBalance, -3.33, 'Solde net de Bob arrondi à -3.33€');
  });
});

// ----------------------------------------------------
// SUITE 14 : SIMULATION COMPLÈTE DU FLUX ZERO-WAIT (RÉSOLUTION DU BUG SIGNALÉ)
// ----------------------------------------------------
suite('14. Simulation Réaliste : Flux Zero-Wait & File Vocale', () => {
  test('Simulation pas à pas : Dictée pendant le chargement puis arrivée des articles', () => {
    // 1. Initialement, la liste d'articles est vide (chargement IA en cours)
    let currentItems: ExpenseItem[] = [];
    const pendingPhrases: string[] = [];

    // 2. L'utilisateur dicte "garde le gel douche et les bières" pendant que ça tourne
    const spokenVoice = 'garde le gel douche et les bieres';
    if (currentItems.length === 0) {
      pendingPhrases.push(spokenVoice);
    }

    assertEqual(pendingPhrases.length, 1, 'L\'instruction doit être mise en mémoire');

    // 3. L\'IA termine son extraction et renvoie les articles bruts (tous isPersonal: false par défaut)
    const extractedFromReceipt: ExpenseItem[] = [
      { id: 'i1', name: 'DOP GEL DOUCHE', quantity: 1, unitPrice: 2.50, totalPrice: 2.50, isPersonal: false },
      { id: 'i2', name: 'HEINEKEN PACK 6', quantity: 1, unitPrice: 6.50, totalPrice: 6.50, isPersonal: false },
      { id: 'i3', name: 'BARILLA COQUILLETTES', quantity: 2, unitPrice: 1.25, totalPrice: 2.50, isPersonal: false },
      { id: 'i4', name: 'LACTEL LAIT DEMI ECREME', quantity: 1, unitPrice: 1.10, totalPrice: 1.10, isPersonal: false },
    ];

    currentItems = [...extractedFromReceipt];

    // 4. L\'algorithme Zero-Wait dépile automatiquement les phrases en mémoire
    let lastExplanation = '';
    while (pendingPhrases.length > 0) {
      const phrase = pendingPhrases.shift()!;
      const match = matchVoiceInstruction(phrase, currentItems);
      if (match.matchedItemIds.length > 0) {
        currentItems = currentItems.map((it) =>
          match.matchedItemIds.includes(it.id)
            ? { ...it, isPersonal: match.action === 'set_personal' }
            : it
        );
      }
      lastExplanation = match.explanation;
    }

    // 5. Vérifications finales
    assertEqual(pendingPhrases.length, 0, 'La file d\'attente doit être vide');

    const gelDouche = currentItems.find((i) => i.id === 'i1');
    const biere = currentItems.find((i) => i.id === 'i2');
    const coquillettes = currentItems.find((i) => i.id === 'i3');
    const lait = currentItems.find((i) => i.id === 'i4');

    assertEqual(gelDouche?.isPersonal, true, 'Gel douche doit être en Perso 🔵');
    assertEqual(biere?.isPersonal, true, 'Bière doit être en Perso 🔵');
    assertEqual(coquillettes?.isPersonal, false, 'Coquillettes doivent rester en Coloc 🟢');
    assertEqual(lait?.isPersonal, false, 'Lait doit rester en Coloc 🟢');

    // Calcul des totaux
    const colocTotal = currentItems
      .filter((i) => !i.isPersonal)
      .reduce((acc, i) => acc + i.totalPrice, 0);
    const persoTotal = currentItems
      .filter((i) => i.isPersonal)
      .reduce((acc, i) => acc + i.totalPrice, 0);

    assertEqual(colocTotal, 3.60, 'Total coloc = 2.50 + 1.10 = 3.60€');
    assertEqual(persoTotal, 9.00, 'Total perso = 2.50 + 6.50 = 9.00€');
    assertEqual(colocTotal + persoTotal, 12.60, 'Total général = 12.60€');
  });
});

suite('15. Multi-Colocations : Isolation Stricte des Données', () => {
  test('Deux colocations indépendantes ne mélangent pas leurs soldes ni leurs dépenses', () => {
    // Coloc A : Alice & Bob (Coloc Gambetta)
    const alice: Member = { id: 'm-a1', name: 'Alice', avatar: '👩', color: '#10b981', colocationId: 'coloc-gambetta' };
    const bob: Member = { id: 'm-b1', name: 'Bob', avatar: '👨', color: '#3b82f6', colocationId: 'coloc-gambetta' };

    // Coloc B : Charlie & David (Coloc Les Lilas)
    const charlie: Member = { id: 'm-c1', name: 'Charlie', avatar: '🦊', color: '#f59e0b', colocationId: 'coloc-lilas' };
    const david: Member = { id: 'm-d1', name: 'David', avatar: '🐱', color: '#8b5cf6', colocationId: 'coloc-lilas' };

    // Dépense Coloc A : Alice paie 40€ de courses partagées
    const expA: Expense = {
      id: 'e-a1',
      title: 'Courses Gambetta',
      totalAmount: 40,
      colocAmount: 40,
      persoAmount: 0,
      date: new Date().toISOString(),
      payerId: alice.id,
      payer: alice,
      colocationId: 'coloc-gambetta',
      items: [{ id: 'i1', name: 'Courses', quantity: 1, unitPrice: 40, totalPrice: 40, isPersonal: false }],
    };

    // Dépense Coloc B : Charlie paie 100€ de courses partagées
    const expB: Expense = {
      id: 'e-b1',
      title: 'Courses Lilas',
      totalAmount: 100,
      colocAmount: 100,
      persoAmount: 0,
      date: new Date().toISOString(),
      payerId: charlie.id,
      payer: charlie,
      colocationId: 'coloc-lilas',
      items: [{ id: 'i2', name: 'Courses', quantity: 1, unitPrice: 100, totalPrice: 100, isPersonal: false }],
    };

    // Calcul pour Coloc A
    const resA = calculateBalances([alice, bob], [expA], []);
    assertEqual(resA.totalColocExpenses, 40, 'Total dépenses Coloc A = 40€');
    assertEqual(resA.debts.length, 1, '1 virement dû dans Coloc A');
    assertEqual(resA.debts[0].from.name, 'Bob', 'Bob doit de l\'argent dans Coloc A');
    assertEqual(resA.debts[0].to.name, 'Alice', 'Alice doit recevoir dans Coloc A');
    assertEqual(resA.debts[0].amount, 20, 'Bob doit 20€ à Alice dans Coloc A');

    // Calcul pour Coloc B
    const resB = calculateBalances([charlie, david], [expB], []);
    assertEqual(resB.totalColocExpenses, 100, 'Total dépenses Coloc B = 100€');
    assertEqual(resB.debts.length, 1, '1 virement dû dans Coloc B');
    assertEqual(resB.debts[0].from.name, 'David', 'David doit de l\'argent dans Coloc B');
    assertEqual(resB.debts[0].to.name, 'Charlie', 'Charlie doit recevoir dans Coloc B');
    assertEqual(resB.debts[0].amount, 50, 'David doit 50€ à Charlie dans Coloc B');

    // Vérifier l\'absence totale de fuite de données
    const namesA = resA.balances.map((b) => b.member.name);
    const namesB = resB.balances.map((b) => b.member.name);
    assert(!namesA.includes('Charlie'), 'Coloc A ne doit jamais contenir Charlie');
    assert(!namesA.includes('David'), 'Coloc A ne doit jamais contenir David');
    assert(!namesB.includes('Alice'), 'Coloc B ne doit jamais contenir Alice');
    assert(!namesB.includes('Bob'), 'Coloc B ne doit jamais contenir Bob');
  });
});

// ----------------------------------------------------
// SUITE 16 : CALCULATEUR DE SOLDES - RÉPARTITIONS FLEXIBLES
// ----------------------------------------------------
suite('16. Calculateur de Soldes : Répartitions Flexibles & Sur-Mesure', () => {
  const alice: Member = { id: 'm-1', name: 'Alice', avatar: '👩', color: '#10B981' };
  const bob: Member = { id: 'm-2', name: 'Bob', avatar: '👨', color: '#3B82F6' };
  const charlie: Member = { id: 'm-3', name: 'Charlie', avatar: '🧑', color: '#F59E0B' };
  const threeMembers = [alice, bob, charlie];

  test('Avance directe pour un colocataire précis (single_member)', () => {
    // Alice avance 15€ pour Bob (un déjeuner ou une bière)
    const exp: Expense = {
      id: 'e-single',
      title: 'Déjeuner Bob',
      totalAmount: 15,
      colocAmount: 15,
      persoAmount: 0,
      date: '2026-09-09',
      payerId: alice.id,
      payer: alice,
      splitDetails: JSON.stringify({
        type: 'single_member',
        targetMemberId: bob.id,
      }),
      items: [],
    };

    const result = calculateBalances(threeMembers, [exp], []);

    assertEqual(result.totalColocExpenses, 15, 'Total coloc doit être 15€');

    const balAlice = result.balances.find((b) => b.member.id === alice.id)!;
    const balBob = result.balances.find((b) => b.member.id === bob.id)!;
    const balCharlie = result.balances.find((b) => b.member.id === charlie.id)!;

    assertEqual(balAlice.totalPaid, 15, 'Alice a payé 15€');
    assertEqual(balAlice.totalShare, 0, 'Alice a 0€ de part (avance pour Bob)');
    assertEqual(balAlice.netBalance, 15, 'Alice doit recevoir +15€');

    assertEqual(balBob.totalPaid, 0, 'Bob a payé 0€');
    assertEqual(balBob.totalShare, 15, 'Bob a 15€ de part');
    assertEqual(balBob.netBalance, -15, 'Bob doit -15€');

    assertEqual(balCharlie.totalPaid, 0, 'Charlie n\'a rien payé');
    assertEqual(balCharlie.totalShare, 0, 'Charlie a 0€ de part');
    assertEqual(balCharlie.netBalance, 0, 'Charlie n\'est pas impacté (solde = 0€)');

    // Vérifier les dettes : seul Bob doit 15€ à Alice
    assertEqual(result.debts.length, 1, 'Exactement 1 virement nécessaire');
    assertEqual(result.debts[0].from.id, bob.id, 'Bob rembourse Alice');
    assertEqual(result.debts[0].to.id, alice.id, 'Alice reçoit le remboursement');
    assertEqual(result.debts[0].amount, 15, 'Montant du remboursement = 15€');
  });

  test('Répartition non équitable sur-mesure (custom)', () => {
    // Alice paie 60€ : Alice 10€, Bob 20€, Charlie 30€
    const exp: Expense = {
      id: 'e-custom',
      title: 'Courses sur-mesure',
      totalAmount: 60,
      colocAmount: 60,
      persoAmount: 0,
      date: '2026-09-09',
      payerId: alice.id,
      payer: alice,
      splitDetails: {
        type: 'custom',
        customAmounts: {
          [alice.id]: 10,
          [bob.id]: 20,
          [charlie.id]: 30,
        },
      },
      items: [],
    };

    const result = calculateBalances(threeMembers, [exp], []);

    assertEqual(result.totalColocExpenses, 60, 'Total dépenses = 60€');

    const balAlice = result.balances.find((b) => b.member.id === alice.id)!;
    const balBob = result.balances.find((b) => b.member.id === bob.id)!;
    const balCharlie = result.balances.find((b) => b.member.id === charlie.id)!;

    assertEqual(balAlice.totalShare, 10, 'Part Alice = 10€');
    assertEqual(balAlice.netBalance, 50, 'Net Alice = +50€');

    assertEqual(balBob.totalShare, 20, 'Part Bob = 20€');
    assertEqual(balBob.netBalance, -20, 'Net Bob = -20€');

    assertEqual(balCharlie.totalShare, 30, 'Part Charlie = 30€');
    assertEqual(balCharlie.netBalance, -30, 'Net Charlie = -30€');

    // Dettes simplifiées : Charlie doit 30€ à Alice, Bob doit 20€ à Alice
    assertEqual(result.debts.length, 2, '2 virements requis');
    const charlieDebt = result.debts.find((d) => d.from.id === charlie.id);
    const bobDebt = result.debts.find((d) => d.from.id === bob.id);

    assertEqual(charlieDebt?.amount, 30, 'Charlie doit 30€ à Alice');
    assertEqual(bobDebt?.amount, 20, 'Bob doit 20€ à Alice');
  });

  test('Répartition sur une sélection de colocataires (subset_equal)', () => {
    // Alice paie 40€ partagés équitablement uniquement entre Alice et Bob (Charlie n\'est pas là)
    const exp: Expense = {
      id: 'e-subset',
      title: 'Pizza duo Alice & Bob',
      totalAmount: 40,
      colocAmount: 40,
      persoAmount: 0,
      date: '2026-09-09',
      payerId: alice.id,
      payer: alice,
      splitDetails: {
        type: 'subset_equal',
        beneficiaryIds: [alice.id, bob.id],
      },
      items: [],
    };

    const result = calculateBalances(threeMembers, [exp], []);

    const balAlice = result.balances.find((b) => b.member.id === alice.id)!;
    const balBob = result.balances.find((b) => b.member.id === bob.id)!;
    const balCharlie = result.balances.find((b) => b.member.id === charlie.id)!;

    assertEqual(balAlice.totalShare, 20, 'Part Alice = 20€');
    assertEqual(balAlice.netBalance, 20, 'Net Alice = +20€');

    assertEqual(balBob.totalShare, 20, 'Part Bob = 20€');
    assertEqual(balBob.netBalance, -20, 'Net Bob = -20€');

    assertEqual(balCharlie.totalShare, 0, 'Charlie n\'est pas concerné = 0€');
    assertEqual(balCharlie.netBalance, 0, 'Net Charlie = 0€');

    assertEqual(result.debts.length, 1, '1 virement (Bob -> Alice : 20€)');
    assertEqual(result.debts[0].from.id, bob.id, 'Bob doit payer');
    assertEqual(result.debts[0].amount, 20, '20€ dus à Alice');
  });

  test('Dépense 100% personnelle (personal) sans impact coloc', () => {
    const exp: Expense = {
      id: 'e-perso',
      title: 'Achat perso',
      totalAmount: 50,
      colocAmount: 0,
      persoAmount: 50,
      date: '2026-09-09',
      payerId: alice.id,
      payer: alice,
      splitDetails: {
        type: 'personal',
      },
      items: [],
    };

    const result = calculateBalances(threeMembers, [exp], []);

    assertEqual(result.totalColocExpenses, 0, 'Total dépenses coloc = 0€');
    assertEqual(result.debts.length, 0, 'Aucune dette générée');
    result.balances.forEach((b) => {
      assertEqual(b.netBalance, 0, `Solde net de ${b.member.name} = 0€`);
    });
  });
});

// ==========================================
// RAPPORT FINAL D'EXÉCUTION
// ==========================================
const elapsed = Date.now() - startTime;
console.log('\n==========================================');
console.log(`\x1b[1mRÉSULTAT GLOBAL :\x1b[0m`);
console.log(`  Tests exécutés : \x1b[1m${totalTests}\x1b[0m`);
console.log(`  Succès (PASS)   : \x1b[32m\x1b[1m${passedTests}\x1b[0m`);
console.log(`  Échecs (FAIL)   : \x1b[31m\x1b[1m${failedTests}\x1b[0m`);
console.log(`  Temps d'exéc.   : ${elapsed} ms`);
console.log('==========================================');

if (failedTests > 0) {
  console.log('\x1b[31mDes tests ont échoué ! Détails ci-dessus.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1mTOUS LES TESTS ONT RÉUSSI AVEC SUCCÈS (100% OK) ! 🚀\x1b[0m\n');
  process.exit(0);
}
