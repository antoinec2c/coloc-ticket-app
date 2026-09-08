'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { MemberBalance, Debt } from '@/types';
import { ArrowRight, CheckCircle2, TrendingUp, Wallet, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  balances: MemberBalance[];
  debts: Debt[];
  totalColocExpenses: number;
  onSettlementDone: () => void;
}

export default function BalanceSummary({
  balances,
  debts,
  totalColocExpenses,
  onSettlementDone,
}: Props) {
  const { currentMember } = useProfile();
  const [settling, setSettling] = useState<string | null>(null);

  // Trouver le solde du coloc actuellement connecté
  const myBalance = balances.find((b) => b.member.id === currentMember?.id);

  const handleSettle = async (debt: Debt) => {
    const key = `${debt.from.id}-${debt.to.id}`;
    setSettling(key);

    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMemberId: debt.from.id,
          toMemberId: debt.to.id,
          amount: debt.amount,
          notes: `Règlement direct de ${debt.from.name} vers ${debt.to.name}`,
        }),
      });

      if (res.ok) {
        // Déclencher les confettis !
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
        onSettlementDone();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettling(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Bannière personnalisée pour le profil connecté */}
      {currentMember && myBalance && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-900/10">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentMember.avatar}</span>
                <h2 className="text-xl font-black">Bonjour {currentMember.name} !</h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-emerald-100/90">
                {myBalance.netBalance > 0.01
                  ? 'Tu as avancé des frais : la coloc te doit de l\'argent.'
                  : myBalance.netBalance < -0.01
                  ? 'Tu as des dépenses communes en attente de remboursement.'
                  : 'Tes comptes avec la coloc sont parfaitement équilibrés !'}
              </p>
            </div>

            <div className="rounded-xl bg-white/15 p-3 sm:text-right backdrop-blur-md border border-white/20">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-200">
                Ton solde net
              </span>
              <div className="text-2xl sm:text-3xl font-black tracking-tight">
                {myBalance.netBalance > 0.01 && '+'}
                {myBalance.netBalance.toFixed(2)} €
              </div>
            </div>
          </div>

          {/* Décoration en arrière-plan */}
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/5 blur-xl pointer-events-none" />
        </div>
      )}

      {/* Cartes récapitulatives du Pot Commun */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Total partagé */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pot Commun Partagé</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900">
            {totalColocExpenses.toFixed(2)} €
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Somme de toutes les dépenses communes validées
          </p>
        </div>

        {/* Soldes de chacun */}
        <div className="md:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2.5">
            Soldes de la colocation
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {balances.map((b) => (
              <div
                key={b.member.id}
                className="flex items-center justify-between rounded-xl bg-gray-50/80 p-2.5 border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{b.member.avatar}</span>
                  <span className="text-xs font-bold text-gray-800">{b.member.name}</span>
                </div>
                <div
                  className={`text-xs font-black px-2 py-0.5 rounded-full ${
                    b.netBalance > 0.01
                      ? 'bg-emerald-100 text-emerald-800'
                      : b.netBalance < -0.01
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {b.netBalance > 0.01 ? '+' : ''}
                  {b.netBalance.toFixed(2)} €
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section des Remboursements Optimisés (Qui doit quoi à qui) */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
              Remboursements simplifiés
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-medium">Algorithme Tricount</span>
        </div>

        {debts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50/60 py-4 text-xs font-semibold text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            Tout le monde est quitte ! Aucune dette en cours.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {debts.map((debt, index) => {
              const key = `${debt.from.id}-${debt.to.id}`;
              const isSettlingThis = settling === key;
              const isMeDebtor = currentMember?.id === debt.from.id;
              const isMeCreditor = currentMember?.id === debt.to.id;

              return (
                <div
                  key={index}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                    isMeDebtor
                      ? 'border-rose-200 bg-rose-50/40 shadow-sm ring-1 ring-rose-200'
                      : isMeCreditor
                      ? 'border-emerald-200 bg-emerald-50/40 shadow-sm'
                      : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{debt.from.avatar}</span>
                    <div className="text-xs">
                      <div className="font-bold text-gray-800">
                        {debt.from.name} <ArrowRight className="inline h-3 w-3 text-gray-400" /> {debt.to.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        doit rembourser <strong className="text-gray-900 font-black">{debt.amount.toFixed(2)} €</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSettle(debt)}
                    disabled={isSettlingThis}
                    className="flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-black active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isSettlingThis ? '...' : 'Régler'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
