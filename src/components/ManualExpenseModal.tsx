'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { ExpenseSplit } from '@/types';
import {
  X,
  Receipt,
  Check,
  AlertCircle,
  Home,
  User,
  Users,
  UserCheck,
  Scale,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

type MainSplitMode = 'all' | 'single' | 'subset' | 'self';

export default function ManualExpenseModal({ onClose, onSaved }: Props) {
  const { currentColoc, currentMember, members } = useProfile();

  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [payerId, setPayerId] = useState(currentMember?.id || members[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Mode de répartition : Toute la coloc | Un colocataire | Sélection | Moi seul
  const [mainMode, setMainMode] = useState<MainSplitMode>('all');

  // Sous-choix équitable vs non équitable (sur-mesure) pour 'all' et 'subset'
  const [isEqualSplit, setIsEqualSplit] = useState<boolean>(true);

  // Pour 'single' : le colocataire cible
  const [targetMemberId, setTargetMemberId] = useState<string>('');

  // Pour 'subset' : liste des colocataires sélectionnés
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Pour 'custom' (non équitable) : montants saisis par membre
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialiser les valeurs par défaut dès que members est chargé
  useEffect(() => {
    if (members.length > 0) {
      if (!payerId) {
        setPayerId(currentMember?.id || members[0].id);
      }
      const other = members.find((m) => m.id !== (currentMember?.id || members[0].id)) || members[0];
      setTargetMemberId(other.id);
      setSelectedMemberIds(members.map((m) => m.id));
    }
  }, [members, currentMember]);

  const numTotal = parseFloat(totalAmount.replace(',', '.')) || 0;

  // Calcul de la somme des montants sur-mesure saisis
  const getCustomSum = (relevantMemberIds: string[]) => {
    return relevantMemberIds.reduce((sum, id) => {
      const val = parseFloat((customAmounts[id] || '0').replace(',', '.')) || 0;
      return sum + val;
    }, 0);
  };

  const relevantIds = mainMode === 'all' ? members.map((m) => m.id) : selectedMemberIds;
  const customSum = Math.round(getCustomSum(relevantIds) * 100) / 100;
  const customDiff = Math.round((numTotal - customSum) * 100) / 100;
  const isExactBalanced = numTotal > 0 && Math.abs(customDiff) < 0.005;

  // Fonction pour pré-remplir équitablement les montants sur-mesure
  const handlePreFillEqual = (targetIds = relevantIds) => {
    if (numTotal <= 0 || targetIds.length === 0) return;
    const baseShare = Math.floor((numTotal / targetIds.length) * 100) / 100;
    const remainder = Math.round((numTotal - baseShare * targetIds.length) * 100) / 100;

    const newMap: Record<string, string> = { ...customAmounts };
    targetIds.forEach((id, idx) => {
      const amt = idx === 0 ? baseShare + remainder : baseShare;
      newMap[id] = amt.toFixed(2);
    });
    setCustomAmounts(newMap);
  };

  // Modification d'un montant avec équilibrage automatique intelligent si 2 colocataires
  const handleAmountChange = (memberId: string, valStr: string) => {
    const newMap: Record<string, string> = { ...customAmounts, [memberId]: valStr };
    const parsedVal = parseFloat(valStr.replace(',', '.')) || 0;

    // Si exactement 2 colocataires sont concernés, équilibrer l'autre immédiatement à 100% !
    if (relevantIds.length === 2 && numTotal > 0) {
      const otherId = relevantIds.find((id) => id !== memberId);
      if (otherId) {
        const remaining = Math.max(0, Math.round((numTotal - parsedVal) * 100) / 100);
        newMap[otherId] = remaining.toFixed(2);
      }
    }

    setCustomAmounts(newMap);
  };

  // Équilibrer automatiquement l'écart en un clic
  const handleAutoBalance = () => {
    if (numTotal <= 0 || relevantIds.length === 0) return;

    if (relevantIds.length === 2) {
      const firstId = relevantIds[0];
      const secondId = relevantIds[1];
      const firstVal = parseFloat((customAmounts[firstId] || '0').replace(',', '.')) || 0;
      const remaining = Math.max(0, Math.round((numTotal - firstVal) * 100) / 100);
      setCustomAmounts({
        ...customAmounts,
        [firstId]: firstVal.toFixed(2),
        [secondId]: remaining.toFixed(2),
      });
      return;
    }

    // Si > 2 colocs : attribuer le reste sur le dernier membre de la liste
    const others = relevantIds.slice(0, -1);
    const sumOthers = others.reduce((s, id) => s + (parseFloat((customAmounts[id] || '0').replace(',', '.')) || 0), 0);
    const lastId = relevantIds[relevantIds.length - 1];
    const remainder = Math.max(0, Math.round((numTotal - sumOthers) * 100) / 100);

    setCustomAmounts({
      ...customAmounts,
      [lastId]: remainder.toFixed(2),
    });
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Au moins un coloc
        next = prev.filter((mId) => mId !== id);
      } else {
        next = [...prev, id];
      }
      return next;
    });
  };

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
    if (!payerId) {
      setErrorMsg('Veuillez sélectionner qui a avancé les frais');
      return;
    }

    let splitDetails: ExpenseSplit | null = null;
    let items: any[] = [];

    // Validation et construction de splitDetails selon le mode
    if (mainMode === 'self') {
      splitDetails = { type: 'personal' };
      items.push({
        name: `${title.trim()} (Perso)`,
        quantity: 1,
        unitPrice: numTotal,
        totalPrice: numTotal,
        isPersonal: true,
        category: 'Perso',
      });
    } else if (mainMode === 'single') {
      if (!targetMemberId) {
        setErrorMsg('Veuillez sélectionner le colocataire bénéficiaire.');
        return;
      }
      splitDetails = {
        type: 'single_member',
        targetMemberId,
      };
      items.push({
        name: `${title.trim()}`,
        quantity: 1,
        unitPrice: numTotal,
        totalPrice: numTotal,
        isPersonal: false,
        category: 'Avance',
      });
    } else if (mainMode === 'all') {
      if (isEqualSplit) {
        splitDetails = { type: 'all_equal' };
        items.push({
          name: title.trim(),
          quantity: 1,
          unitPrice: numTotal,
          totalPrice: numTotal,
          isPersonal: false,
          category: 'Coloc',
        });
      } else {
        // Montants sur mesure pour toute la coloc
        if (!isExactBalanced) {
          setErrorMsg(
            `La somme des parts (${customSum.toFixed(2)} €) ne correspond pas exactement au total (${numTotal.toFixed(2)} €). Écart : ${customDiff > 0 ? '+' : ''}${customDiff.toFixed(2)} €. Cliquez sur "Équilibrer" pour ajuster automatiquement.`
          );
          return;
        }

        const amountsRecord: Record<string, number> = {};
        members.forEach((m) => {
          const amt = parseFloat((customAmounts[m.id] || '0').replace(',', '.')) || 0;
          if (amt > 0) amountsRecord[m.id] = amt;
        });

        splitDetails = {
          type: 'custom',
          customAmounts: amountsRecord,
        };
        items.push({
          name: `${title.trim()} (Sur-mesure)`,
          quantity: 1,
          unitPrice: numTotal,
          totalPrice: numTotal,
          isPersonal: false,
          category: 'Coloc',
        });
      }
    } else if (mainMode === 'subset') {
      if (selectedMemberIds.length === 0) {
        setErrorMsg('Veuillez sélectionner au moins un colocataire.');
        return;
      }

      if (isEqualSplit) {
        splitDetails = {
          type: 'subset_equal',
          beneficiaryIds: selectedMemberIds,
        };
        items.push({
          name: title.trim(),
          quantity: 1,
          unitPrice: numTotal,
          totalPrice: numTotal,
          isPersonal: false,
          category: 'Coloc',
        });
      } else {
        // Montants sur mesure pour la sélection
        if (!isExactBalanced) {
          setErrorMsg(
            `La somme des parts (${customSum.toFixed(2)} €) ne correspond pas exactement au total (${numTotal.toFixed(2)} €). Écart : ${customDiff > 0 ? '+' : ''}${customDiff.toFixed(2)} €. Cliquez sur "Équilibrer" pour ajuster automatiquement.`
          );
          return;
        }

        const amountsRecord: Record<string, number> = {};
        selectedMemberIds.forEach((mId) => {
          const amt = parseFloat((customAmounts[mId] || '0').replace(',', '.')) || 0;
          if (amt > 0) amountsRecord[mId] = amt;
        });

        splitDetails = {
          type: 'custom',
          customAmounts: amountsRecord,
        };
        items.push({
          name: `${title.trim()} (Sélection sur-mesure)`,
          quantity: 1,
          unitPrice: numTotal,
          totalPrice: numTotal,
          isPersonal: false,
          category: 'Coloc',
        });
      }
    }

    setLoading(true);
    setErrorMsg(null);

    try {
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
          splitDetails,
          fileType: 'manual',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const payerMember = members.find((m) => m.id === payerId);
  const targetMember = members.find((m) => m.id === targetMemberId);

  // Rendu de la liste personnalisée avec inputs et curseurs
  const renderCustomInputsList = (memberList: typeof members) => {
    return (
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
          <span>Part par colocataire :</span>
          <button
            type="button"
            onClick={() => handlePreFillEqual(memberList.map((m) => m.id))}
            className="text-emerald-700 hover:underline flex items-center gap-1"
          >
            <Scale className="h-3 w-3" />
            <span>Diviser équitablement</span>
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {memberList.map((m) => {
            const currentValStr = customAmounts[m.id] || '';
            const numVal = parseFloat(currentValStr.replace(',', '.')) || 0;
            const pct = numTotal > 0 ? Math.min(100, Math.round((numVal / numTotal) * 100)) : 0;

            return (
              <div
                key={m.id}
                className="rounded-2xl bg-white border border-gray-200 p-2.5 space-y-1.5 shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                    <span className="text-base">{m.avatar}</span>
                    <span>{m.name}</span>
                    {m.id === payerId && (
                      <span className="text-[10px] text-gray-400 font-semibold">(Payeur)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 min-w-[34px] text-right">
                      {pct}%
                    </span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={numTotal || undefined}
                        placeholder="0.00"
                        value={customAmounts[m.id] ?? ''}
                        onChange={(e) => handleAmountChange(m.id, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 py-1 pl-2 pr-6 text-right text-xs font-black text-gray-900 focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                        €
                      </span>
                    </div>
                  </div>
                </div>

                {/* Curseur coulissant (Slider) */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min="0"
                    max={numTotal > 0 ? numTotal : 100}
                    step="0.01"
                    value={numVal}
                    onChange={(e) => handleAmountChange(m.id, parseFloat(e.target.value).toFixed(2))}
                    className="w-full accent-emerald-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Somme, Écart et Bouton Équilibrer */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between rounded-xl p-2.5 text-xs font-bold gap-2 ${
            isExactBalanced
              ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100/80 text-amber-900 border border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between">
            <span>
              Total saisi : <strong>{customSum.toFixed(2)} €</strong> / {numTotal.toFixed(2)} €
            </span>
            {isExactBalanced && <span>✅ Équilibré</span>}
          </div>

          {!isExactBalanced && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <span>
                Écart : <strong>{customDiff > 0 ? '+' : ''}{customDiff.toFixed(2)} €</strong>
              </span>
              <button
                type="button"
                onClick={handleAutoBalance}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-black shadow-sm flex items-center gap-1 transition-all active:scale-95 shrink-0"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Équilibrer</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition-all max-h-[92vh] overflow-y-auto">
        {/* Header */}
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
              placeholder="Ex: Courses Carrefour, Uber, Resto, Facture EDF..."
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
                onChange={(e) => {
                  setTotalAmount(e.target.value);
                  const newTotal = parseFloat(e.target.value.replace(',', '.')) || 0;
                  // Si 2 colocs en mode sur-mesure et que customAmounts était déjà là, pré-remplir
                  if (relevantIds.length === 2 && newTotal > 0 && !isEqualSplit) {
                    const firstId = relevantIds[0];
                    const firstVal = parseFloat((customAmounts[firstId] || '0').replace(',', '.')) || 0;
                    if (firstVal > 0 && firstVal <= newTotal) {
                      setCustomAmounts({
                        ...customAmounts,
                        [relevantIds[1]]: (newTotal - firstVal).toFixed(2),
                      });
                    }
                  }
                }}
                placeholder="0.00"
                required
                className="w-full rounded-xl border border-gray-300 pl-3.5 pr-10 py-2.5 text-lg font-black text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-black text-gray-400 text-base">
                €
              </span>
            </div>
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

          {/* RÉPARTITION : CHOIX PRINCIPAL */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Pour qui est cette dépense ?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMainMode('all');
                  if (!isEqualSplit) handlePreFillEqual(members.map((m) => m.id));
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-xs font-bold transition-all ${
                  mainMode === 'all'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Toute la coloc</span>
              </button>

              <button
                type="button"
                onClick={() => setMainMode('single')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-xs font-bold transition-all ${
                  mainMode === 'single'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Un coloc</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMainMode('subset');
                  if (!isEqualSplit) handlePreFillEqual(selectedMemberIds);
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-xs font-bold transition-all ${
                  mainMode === 'subset'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Sélection</span>
              </button>

              <button
                type="button"
                onClick={() => setMainMode('self')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-xs font-bold transition-all ${
                  mainMode === 'self'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>Moi seul</span>
              </button>
            </div>
          </div>

          {/* DÉTAILS SELON LE MODE CHOISI */}

          {/* 1. TOUTE LA COLOC */}
          {mainMode === 'all' && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3 animate-fadeIn">
              {/* Toggle Équitable vs Sur-mesure */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Mode de partage :</span>
                <div className="flex items-center gap-1 rounded-xl bg-gray-200/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setIsEqualSplit(true)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      isEqualSplit
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span>Parts égales</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEqualSplit(false);
                      handlePreFillEqual(members.map((m) => m.id));
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      !isEqualSplit
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Sur-mesure</span>
                  </button>
                </div>
              </div>

              {isEqualSplit ? (
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                  💡 Divisé équitablement entre les <strong>{members.length} colocataires</strong> (soit{' '}
                  <strong>
                    {members.length > 0 ? (numTotal / members.length).toFixed(2) : 0} €
                  </strong>{' '}
                  chacun).
                </div>
              ) : (
                renderCustomInputsList(members)
              )}
            </div>
          )}

          {/* 2. UN COLOCATAIRE PRÉCIS (AVANCE DIRECTE) */}
          {mainMode === 'single' && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3 animate-fadeIn">
              <label className="block text-xs font-bold text-gray-700">
                Pour qui avancez-vous ces frais ?
              </label>

              <select
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:border-emerald-500 focus:outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.avatar} {m.name} {m.id === payerId ? '(Payeur)' : ''}
                  </option>
                ))}
              </select>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-900">
                💡 <strong>{targetMember?.name || 'Ce coloc'}</strong> devra l'intégralité du
                montant (<strong>{numTotal.toFixed(2)} €</strong>) à{' '}
                <strong>{payerMember?.name || 'vous'}</strong>. Les autres colocataires ne seront pas
                impactés.
              </div>
            </div>
          )}

          {/* 3. SÉLECTION DE PLUSIEURS COLOCS */}
          {mainMode === 'subset' && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Qui participe ?</span>
                <div className="flex items-center gap-1 rounded-xl bg-gray-200/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => setIsEqualSplit(true)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                      isEqualSplit
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Scale className="h-3 w-3" />
                    <span>Équitable</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEqualSplit(false);
                      handlePreFillEqual(selectedMemberIds);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                      !isEqualSplit
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Sur-mesure</span>
                  </button>
                </div>
              </div>

              {/* Liste à cocher pour sélection */}
              <div className="grid grid-cols-2 gap-1.5">
                {members.map((m) => {
                  const isChecked = selectedMemberIds.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleMemberSelection(m.id)}
                      className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition-all ${
                        isChecked
                          ? 'border-emerald-400 bg-emerald-50/60 shadow-sm'
                          : 'border-gray-200 bg-white opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-800 truncate">
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">
                          {m.avatar} {m.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isEqualSplit ? (
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-2 text-xs text-emerald-800">
                  💡 Divisé équitablement entre les{' '}
                  <strong>{selectedMemberIds.length} colocataires cochés</strong> (soit{' '}
                  <strong>
                    {selectedMemberIds.length > 0
                      ? (numTotal / selectedMemberIds.length).toFixed(2)
                      : 0}{' '}
                    €
                  </strong>{' '}
                  chacun).
                </div>
              ) : (
                renderCustomInputsList(members.filter((m) => selectedMemberIds.includes(m.id)))
              )}
            </div>
          )}

          {/* 4. JUSTE POUR MOI (100% PERSO) */}
          {mainMode === 'self' && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <UserCheck className="h-4 w-4" />
                <span>Dépense 100% personnelle</span>
              </div>
              <p className="text-xs text-blue-800/90 leading-relaxed">
                Cette dépense sera enregistrée dans votre historique mais n'impactera{' '}
                <strong>aucun compte ni solde</strong> de la colocation.
              </p>
            </div>
          )}

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

