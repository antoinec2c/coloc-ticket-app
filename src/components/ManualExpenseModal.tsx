'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { X, Receipt, Check, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function ManualExpenseModal({ onClose, onSaved }: Props) {
  const { currentColoc, currentMember, members } = useProfile();

  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [payerId, setPayerId] = useState(currentMember?.id || members[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Répartition : 'all_coloc' | 'all_perso' | 'custom'
  const [splitMode, setSplitMode] = useState<'all_coloc' | 'all_perso' | 'custom'>('all_coloc');
  const [persoAmount, setPersoAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numTotal = parseFloat(totalAmount.replace(',', '.')) || 0;
  const numPerso = splitMode === 'all_perso' 
    ? numTotal 
    : splitMode === 'all_coloc' 
    ? 0 
    : parseFloat(persoAmount.replace(',', '.')) || 0;
  const numColoc = Math.max(0, Math.round((numTotal - numPerso) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Veuillez renseigner un titre ou magasin');
      return;
    }
    if (numTotal <= 0) {
      setErrorMsg('Le montant doit être supérieur à 0 €');
      return;
    }
    if (numPerso > numTotal) {
      setErrorMsg('Le montant personnel ne peut pas dépasser le total');
      return;
    }
    if (!payerId) {
      setErrorMsg('Veuillez sélectionner qui a avancé les frais');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const items = [];
      if (numColoc > 0) {
        items.push({
          name: splitMode === 'custom' ? `${title.trim()} (Part Coloc)` : title.trim(),
          quantity: 1,
          unitPrice: numColoc,
          totalPrice: numColoc,
          isPersonal: false,
          category: 'Divers',
        });
      }
      if (numPerso > 0) {
        items.push({
          name: splitMode === 'custom' ? `${title.trim()} (Part Perso)` : title.trim(),
          quantity: 1,
          unitPrice: numPerso,
          totalPrice: numPerso,
          isPersonal: true,
          category: 'Perso',
        });
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          store: title.trim(),
          date,
          payerId,
          colocationId: currentColoc?.id || null,
          items,
          fileType: 'manual',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l\'enregistrement');
      }

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">Saisie d'une dépense</h3>
              <p className="text-[11px] text-gray-400">Sans ticket de caisse</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Titre / Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Titre / Magasin
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Courses Carrefour, Facture EDF, Boulangerie..."
              required
              autoFocus
              className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {/* Montant Total */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Montant total payé
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-xl border border-gray-300 pl-3.5 pr-10 py-2.5 text-lg font-black text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-base">
                €
              </span>
            </div>
          </div>

          {/* Répartition */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Répartition des frais
            </label>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setSplitMode('all_coloc')}
                className={`rounded-xl py-2 text-xs font-bold transition-all ${
                  splitMode === 'all_coloc'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🟢 100% Coloc
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`rounded-xl py-2 text-xs font-bold transition-all ${
                  splitMode === 'custom'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                ⚖️ Mixte
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('all_perso')}
                className={`rounded-xl py-2 text-xs font-bold transition-all ${
                  splitMode === 'all_perso'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🔵 100% Perso
              </button>
            </div>

            {/* Si mode Mixte : saisie part perso */}
            {splitMode === 'custom' && (
              <div className="mt-2.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2 animate-fadeIn">
                <label className="block text-[11px] font-bold text-gray-600">
                  Part personnelle (gardée pour vous)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={numTotal}
                    value={persoAmount}
                    onChange={(e) => setPersoAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 pl-3 pr-8 py-1.5 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-xs">
                    €
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-gray-500 pt-1">
                  <span>Part Coloc : <strong className="text-emerald-700">{numColoc.toFixed(2)} €</strong></span>
                  <span>Part Perso : <strong className="text-blue-700">{numPerso.toFixed(2)} €</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Payeur */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Qui a avancé les frais ?
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.avatar} {m.name} {m.id === currentMember?.id ? '(Moi)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Date de la dépense
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || numTotal <= 0 || !title.trim()}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.99]"
            >
              {loading ? 'Enregistrement...' : `Valider (${numTotal.toFixed(2)} €) 🚀`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
