import { Member, Expense, Settlement, MemberBalance, Debt } from '@/types';

/**
 * Calcule les soldes de chaque colocataire et simplifie les dettes (algorithme Splitwise/Tricount).
 */
export function calculateBalances(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[] = []
): {
  balances: MemberBalance[];
  debts: Debt[];
  totalColocExpenses: number;
} {
  if (!members || members.length === 0) {
    return { balances: [], debts: [], totalColocExpenses: 0 };
  }

  const memberMap = new Map<string, MemberBalance>();
  
  // Initialiser les balances pour chaque membre
  members.forEach((m) => {
    memberMap.set(m.id, {
      member: m,
      totalPaid: 0,
      totalShare: 0,
      netBalance: 0,
    });
  });

  let totalColocExpenses = 0;

  // Calculer l'impact de chaque dépense
  expenses.forEach((expense) => {
    const colocPart = expense.colocAmount || 0;
    totalColocExpenses += colocPart;

    // Le payeur a avancé colocPart pour le groupe
    const payerBal = memberMap.get(expense.payerId);
    if (payerBal) {
      payerBal.totalPaid += colocPart;
    }

    // Répartition équitable de la part coloc entre tous les membres actifs
    const sharePerMember = colocPart / members.length;
    members.forEach((m) => {
      const bal = memberMap.get(m.id);
      if (bal) {
        bal.totalShare += sharePerMember;
      }
    });
  });

  // Calculer le solde net initial
  members.forEach((m) => {
    const bal = memberMap.get(m.id)!;
    bal.netBalance = bal.totalPaid - bal.totalShare;
  });

  // Prendre en compte les remboursements / règlements déjà effectués
  settlements.forEach((s) => {
    const fromBal = memberMap.get(s.fromMemberId);
    const toBal = memberMap.get(s.toMemberId);
    if (fromBal) {
      // fromMember a remboursé de l'argent, son solde net remonte
      fromBal.netBalance += s.amount;
    }
    if (toBal) {
      // toMember a reçu un remboursement, sa créance diminue
      toBal.netBalance -= s.amount;
    }
  });

  const balances = Array.from(memberMap.values()).map((b) => ({
    ...b,
    totalPaid: Math.round(b.totalPaid * 100) / 100,
    totalShare: Math.round(b.totalShare * 100) / 100,
    netBalance: Math.round(b.netBalance * 100) / 100,
  }));

  // Algorithme de simplification des dettes (Minimisation du nombre de virements)
  const debts = simplifyDebts(balances);

  return {
    balances,
    debts,
    totalColocExpenses: Math.round(totalColocExpenses * 100) / 100,
  };
}

/**
 * Algorithme glouton pour équilibrer les créances avec le minimum de transactions.
 */
function simplifyDebts(balances: MemberBalance[]): Debt[] {
  const debts: Debt[] = [];

  // Séparer les débiteurs (< -0.01) et les créanciers (> 0.01)
  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ member: b.member, amount: -b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.netBalance > 0.01)
    .map((b) => ({ member: b.member, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0.01) {
      debts.push({
        from: debtor.member,
        to: creditor.member,
        amount: Math.round(transferAmount * 100) / 100,
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return debts;
}
