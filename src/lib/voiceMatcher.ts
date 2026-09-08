import { ExpenseItem } from '@/types';

export interface VoiceMatchResult {
  matchedItemIds: string[];
  action: 'set_personal' | 'set_coloc';
  explanation: string;
  matchedNames: string[];
}

/**
 * Normalise une chaîne (minuscules, sans accents, sans ponctuation).
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Racinise sommairement un mot français (retire le 's' ou 'x' pluriel).
 */
function stemWord(word: string): string {
  if (word.length > 3 && (word.endsWith('s') || word.endsWith('x'))) {
    return word.slice(0, -1);
  }
  return word;
}

const synonyms: Record<string, string[]> = {
  chocolat: ['choc', 'bueno', 'kinder', 'nutella', 'tablette', 'milka', 'lindt', 'cote d or', 'ferrero', 'cacao'],
  gateau: ['biscuit', 'cookie', 'cookies', 'bn', 'oreo', 'lu', 'granola', 'prince', 'madeleine', 'cake', 'gaufre'],
  biscuit: ['gateau', 'cookie', 'cookies', 'bn', 'oreo', 'lu', 'granola', 'prince', 'madeleine', 'sable'],
  shampoing: ['shamp', 'head', 'shoulders', 'garnier', 'elseve', 'dop', 'ultra doux', 'fructis'],
  biere: ['pack', 'heineken', 'kronenbourg', 'ipa', 'leffe', 'despe', '1664', 'blonde', 'stella', 'grimbergen', 'kro'],
  chips: ['lays', 'doritos', 'pringles', 'aperitif', 'brets', 'tortilla', 'vico', 'curly', 'monster munch'],
  savon: ['gel', 'douche', 'dove', 'axe', 'marseillais', 'sanex', 'palmolive', 'tahiti', 'cadum', 'ushuaia'],
  douche: ['gel', 'savon', 'dove', 'axe', 'marseillais', 'sanex', 'tahiti', 'cadum', 'ushuaia'],
  dentifrice: ['colgate', 'signal', 'oral b', 'sensodyne', 'dent', 'aquafresh'],
  cafe: ['expresso', 'capsule', 'nespresso', 'senseo', 'grain', 'moulu', 'carte noire', 'lavazza', 'dolce gusto'],
  the: ['lipton', 'twinings', 'infusion', 'tisane', 'verveine'],
  fromage: ['comte', 'emmental', 'mozza', 'gruyere', 'chevre', 'rape', 'camembert', 'brie', 'parmesan', 'roquefort'],
  boisson: ['coca', 'pepsi', 'fanta', 'sprite', 'oasis', 'jus', 'soda', 'schweppes', 'ice tea', 'fuze tea'],
  soda: ['coca', 'pepsi', 'fanta', 'sprite', 'oasis', 'jus', 'boisson', 'schweppes', 'ice tea'],
  lait: ['lactel', 'candia', 'brique', 'demi', 'ecreme'],
  pates: ['penne', 'spaghetti', 'coquillettes', 'barilla', 'panzani', 'lustucru', 'tagliatelle', 'fusilli', 'macaroni'],
  riz: ['basmati', 'thai', 'taureau aile', 'lustucru', 'oncle bens'],
  pain: ['baguette', 'mie', 'brioche', 'pain de mie', 'pain burger', 'croissant'],
  yaourt: ['yoghurt', 'yogourt', 'yop', 'danone', 'activia', 'danette', 'perle de lait', 'mousse', 'creme dessert'],
  viande: ['steak', 'poulet', 'boeuf', 'porc', 'dinde', 'jambon', 'hache', 'lardon', 'saucisse', 'charcuterie', 'escalope'],
  poisson: ['saumon', 'thon', 'cabillaud', 'colin', 'crevette', 'sardine', 'maquereau'],
  pizza: ['buitoni', 'dr oetker', 'royale', 'reine', '4 fromages', 'margarita', 'margherita'],
  eau: ['cristaline', 'evian', 'volvic', 'vittel', 'san pellegrino', 'perrier', 'badoit'],
  papier: ['toilette', 'hygienique', 'sopalin', 'essuie tout', 'mouchoir', 'lotus', 'kleenex'],
  lessive: ['ariel', 'skip', 'dash', 'persil', 'adoucissant', 'assouplissant', 'soupline', 'lenor'],
  vaisselle: ['paic', 'fairy', 'finish', 'sun', 'liquide vaisselle', 'eponge'],
  deodorant: ['deo', 'axe', 'dove', 'rexona', 'nivea', 'brut'],
  beurre: ['president', 'doux', 'demi sel', 'breton', 'motte', 'plaquette'],
  vin: ['rouge', 'blanc', 'bordeaux', 'rose', 'bouteille', 'cepage', 'merlot'],
  saucisson: ['cochonou', 'justin bridou', 'sec', 'baton de berger', 'rosette'],
  confiture: ['bonne maman', 'fraise', 'abricot', 'marmelade', 'conf'],
  oeuf: ['oeufs', 'bio', 'plein air', 'calibre', 'matines', 'loue'],
  'pomme de terre': [
    'patate', 'patates', 'pommes de terre', 'pdt', 'rissolee', 'rissolees',
    'frite', 'frites', 'puree', 'noisette', 'noisettes', 'grenaille', 'vapeur',
    'mccain', 'lutosa', 'st eloi', 'mousseline', 'charlotte', 'bintje', 'darphin', 'rosti'
  ],
  patate: [
    'pomme de terre', 'pommes de terre', 'pdt', 'rissolee', 'rissolees',
    'frite', 'frites', 'puree', 'noisette', 'noisettes', 'grenaille', 'vapeur',
    'mccain', 'lutosa', 'st eloi', 'mousseline'
  ],
  rissolee: [
    'pomme de terre', 'pommes de terre', 'patate', 'patates', 'pdt', 'st eloi', 'mccain', 'pommes rissolees'
  ],
  frite: [
    'pomme de terre', 'pommes de terre', 'patate', 'patates', 'mccain', 'lutosa', 'belviva'
  ],
  puree: [
    'mousseline', 'pomme de terre', 'patate', 'flocons'
  ],
};

const stopWords = new Set([
  'garde', 'garder', 'gardes', 'prends', 'prend', 'prendre', 'pris', 'met', 'mets', 'mettre',
  'ajoute', 'ajouter', 'achete', 'acheter', 'paye', 'payer',
  'pour', 'moi', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'en',
  'perso', 'personnel', 'coloc', 'colocation', 'tout', 'tous', 'monde', 'reste', 'c', 'est', 'et',
  'ou', 'avec', 'sans', 'dans', 'sur', 'ce', 'cet', 'cette', 'ces', 'svp', 'merci', 'sauf', 'juste',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'mon', 'ma', 'mes',
  'aussi', 'encore', 'autre', 'autres', 'alors', 'donc', 'soit', 'fait', 'faire'
]);

/**
 * Vérifie si un mot-clé ou une expression apparaît dans le texte,
 * en gérant les pluriels/singuliers et les limites de mots.
 * (ex: "pommes de terre" match "pomme de terre", "mon" ne match pas "monde").
 */
function hasPhraseMatch(text: string, phrase: string, stemmedWords: string[]): boolean {
  if (!text || !phrase) return false;

  // 1. Si expression multi-mots (ex: "pommes de terre", "pour la coloc")
  if (phrase.includes(' ')) {
    if (text.includes(phrase)) return true;
    const pWords = phrase
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
      .map(stemWord);
    if (pWords.length > 0 && pWords.every((pw) => stemmedWords.includes(pw))) {
      return true;
    }
    return false;
  }

  // 2. Mot unique : TOUJOURS avec frontières de mots entiers pour éviter les faux-positifs
  // (ex: "mon" ne doit JAMAIS matcher "monde" ou "saumon", "gel" ne doit pas matcher "surgelés")
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
  return regex.test(text);
}

/**
 * Analyse une commande vocale (ex: "Garde pour moi le gel douche et les chocolats")
 * et détermine quels articles doivent passer en 'Perso' ou en 'Coloc'.
 */
export function matchVoiceInstruction(
  transcript: string,
  items: ExpenseItem[]
): VoiceMatchResult {
  const normTranscript = normalizeText(transcript);

  // 1. Détection des ordres globaux ("Tout est pour la coloc", "Rien pour moi")
  if (
    normTranscript.includes('rien pour moi') ||
    normTranscript.includes('tout est pour la coloc') ||
    normTranscript.includes('tout pour la coloc') ||
    normTranscript.includes('rien de perso') ||
    normTranscript.includes('tout pour tout le monde') ||
    normTranscript.includes('tout en coloc')
  ) {
    return {
      matchedItemIds: items.map((it) => it.id),
      action: 'set_coloc',
      explanation: 'Tous les articles sont attribués à la coloc ! 🟢',
      matchedNames: items.map((it) => it.name),
    };
  }

  if (
    normTranscript.includes('tout est pour moi') ||
    normTranscript.includes('tout pour moi') ||
    normTranscript.includes('garde tout') ||
    normTranscript.includes('tout en perso') ||
    normTranscript.includes('c est tout pour moi')
  ) {
    return {
      matchedItemIds: items.map((it) => it.id),
      action: 'set_personal',
      explanation: 'Tous les articles sont marqués comme personnels ! 🔵',
      matchedNames: items.map((it) => it.name),
    };
  }

  // Mots clés d'intention
  const personalKeywords = [
    'garde pour moi',
    'pour moi',
    'en perso',
    'mon',
    'ma',
    'mes',
    'juste moi',
    'a moi',
    'perso',
    'garde',
    'sauf',
    'prends',
    'pris',
    'je prends',
  ];

  const colocKeywords = [
    'pour la coloc',
    'pour tout le monde',
    'tout le monde',
    'en commun',
    'partage',
    'coloc',
    'remets en coloc',
    'remettre en coloc',
  ];

  // Découper et raciniser les mots signifiants de la phrase
  const spokenWords = normTranscript
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  const stemmedSpokenWords = spokenWords.map(stemWord);

  const hasPersonalIntent = personalKeywords.some((kw) =>
    hasPhraseMatch(normTranscript, kw, stemmedSpokenWords)
  );
  const hasColocIntent = colocKeywords.some((kw) =>
    hasPhraseMatch(normTranscript, kw, stemmedSpokenWords)
  );

  // Par défaut, si l'utilisateur nomme des articles ("le gel douche et les chips"), c'est pour les garder en perso
  const action: 'set_personal' | 'set_coloc' =
    hasColocIntent && !hasPersonalIntent ? 'set_coloc' : 'set_personal';

  const matchedItemIds: string[] = [];
  const matchedNames: string[] = [];

  items.forEach((item) => {
    const normItemName = normalizeText(item.name);
    const itemWords = normItemName.split(/\s+/).filter((w) => w.length > 2);
    const stemmedItemWords = itemWords.map(stemWord);

    let isMatch = false;

    // 1. Nom exact présent dans la phrase
    if (normTranscript.includes(normItemName)) {
      isMatch = true;
    }

    // 2. Correspondance par mot ou racine de mot
    if (!isMatch) {
      for (const spk of stemmedSpokenWords) {
        if (spk.length < 3) continue;
        for (const iw of stemmedItemWords) {
          if (iw.length < 3) continue;
          if (iw === spk || (spk.length >= 4 && (iw.startsWith(spk) || spk.startsWith(iw)))) {
            isMatch = true;
            break;
          }
        }
        if (isMatch) break;
      }
    }

    // 3. Correspondance via dictionnaire de synonymes
    if (!isMatch) {
      for (const [key, synList] of Object.entries(synonyms)) {
        const keyStem = stemWord(key);
        // L'utilisateur a-t-il mentionné la clé ou l'un de ses synonymes ?
        const userMentionedKey =
          stemmedSpokenWords.includes(keyStem) ||
          hasPhraseMatch(normTranscript, key, stemmedSpokenWords) ||
          synList.some((syn) => hasPhraseMatch(normTranscript, syn, stemmedSpokenWords));

        if (userMentionedKey) {
          // L'article contient-il le mot clé ou un synonyme ?
          const itemMatchesSyn =
            stemmedItemWords.includes(keyStem) ||
            hasPhraseMatch(normItemName, key, stemmedItemWords) ||
            synList.some((syn) => {
              if (syn.includes(' ')) {
                return (
                  normItemName.includes(syn) ||
                  hasPhraseMatch(normItemName, syn, stemmedItemWords)
                );
              }
              // Pour les synonymes d'un mot :
              // Soit mot exact dans l'article, soit préfixe si >= 4 lettres (ex: "choc" pour "chocolat")
              return stemmedItemWords.some((iw) =>
                iw === syn || (syn.length >= 4 && (iw.startsWith(syn) || syn.startsWith(iw)))
              );
            });

          if (itemMatchesSyn) {
            isMatch = true;
            break;
          }
        }
      }
    }

    if (isMatch) {
      matchedItemIds.push(item.id);
      matchedNames.push(item.name);
    }
  });

  let explanation = '';
  if (matchedItemIds.length === 0) {
    explanation = "Aucun article correspondant n'a été trouvé dans ce ticket.";
  } else {
    const count = matchedItemIds.length;
    const targetLabel = action === 'set_personal' ? 'Perso 🔵' : 'Coloc 🟢';
    explanation = `${count} article${count > 1 ? 's' : ''} passé${count > 1 ? 's' : ''} en ${targetLabel} : ${matchedNames.join(', ')}`;
  }

  return {
    matchedItemIds,
    action,
    explanation,
    matchedNames,
  };
}
