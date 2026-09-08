import { prisma } from './db';

/**
 * Base de données propre : aucune fausse dépense ni faux ticket démo ni faux profil par défaut.
 * Les utilisateurs créent directement leurs vrais profils.
 */
export async function ensureDefaultData() {
  // Pas de création forcée de profil 'Moi'.
}

