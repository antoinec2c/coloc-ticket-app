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
    // Analyser splitDetails si présent
    let split: any = null;
    if (expense.splitDetails) {
      if (typeof expense.splitDetails === 'string') {
        try {
          split = JSON.parse(expense.splitDetails);
        } catch {
          split = null;
        }
      } else if (typeof expense.splitDetails === 'object') {
        split = expense.splitDetails;
      }
    }

    // 1. Dépense 100% personnelle : aucun impact sur les comptes coloc
    if (split?.type === 'personal') {
      return;
    }

    // 2. Répartition pour un colocataire précis (avance directe)
    if (split?.type === 'single_member' && split.targetMemberId) {
      const amount = expense.colocAmount || expense.totalAmount || 0;
      if (amount <= 0) return;

      totalColocExpenses += amount;

      const payerBal = memberMap.get(expense.payerId);
      if (payerBal) {
        payerBal.totalPaid += amount;
      }

      const targetBal = memberMap.get(split.targetMemberId);
      if (targetBal) {
        targetBal.totalShare += amount;
      }
      return;
    }

    // 3. Répartition personnalisée avec montants sur mesure par colocataire
    if (split?.type === 'custom' && split.customAmounts) {
      const customMap = split.customAmounts as Record<string, number>;
      let customTotal = 0;
      Object.entries(customMap).forEach(([mId, amt]) => {
        const numAmt = Number(amt) || 0;
        if (numAmt > 0) {
          customTotal += numAmt;
          const bal = memberMap.get(mId);
          if (bal) {
            bal.totalShare += numAmt;
          }
        }
      });

      const actualColocAmount = customTotal > 0 ? customTotal : (expense.colocAmount || 0);
      totalColocExpenses += actualColocAmount;

      const payerBal = memberMap.get(expense.payerId);
      if (payerBal) {
        payerBal.totalPaid += actualColocAmount;
      }
      return;
    }

    // 4. Répartition équitable sur un sous-ensemble de colocataires
    if (split?.type === 'subset_equal' && Array.isArray(split.beneficiaryIds) && split.beneficiaryIds.length > 0) {
      const colocPart = expense.colocAmount || 0;
      if (colocPart <= 0) return;

      totalColocExpenses += colocPart;

      const payerBal = memberMap.get(expense.payerId);
      if (payerBal) {
        payerBal.totalPaid += colocPart;
      }

      const validBeneficiaries = split.beneficiaryIds.filter((id: string) => memberMap.has(id));
      const count = validBeneficiaries.length > 0 ? validBeneficiaries.length : members.length;
      const share = colocPart / count;

      if (validBeneficiaries.length > 0) {
        validBeneficiaries.forEach((id: string) => {
          const bal = memberMap.get(id);
          if (bal) bal.totalShare += share;
        });
      } else {
        members.forEach((m) => {
          const bal = memberMap.get(m.id);
          if (bal) bal.totalShare += share;
        });
      }
      return;
    }

    // 5. Cas standard / Rétrocompatibilité : répartition équitable entre tous les membres actifs
    const colocPart = expense.colocAmount || 0;
    if (colocPart <= 0) return;

    totalColocExpenses += colocPart;

    const payerBal = memberMap.get(expense.payerId);
    if (payerBal) {
      payerBal.totalPaid += colocPart;
    }

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
