'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { Member, Expense, MemberBalance, Debt, ExtractedReceipt } from '@/types';
import ZeroWaitReview from '@/components/ZeroWaitReview';
import ManualExpenseModal from '@/components/ManualExpenseModal';
import {
  Camera,
  Upload,
  Receipt,
  CheckCircle2,
  Trash2,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Home() {
  const { currentColoc, currentMember } = useProfile();

  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalColocExpenses, setTotalColocExpenses] = useState(0);

  // Vue : 'dashboard' | 'review'
  const [viewState, setViewState] = useState<'dashboard' | 'review'>('dashboard');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [manualInitialData, setManualInitialData] = useState<ExtractedReceipt | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  const [clearing, setClearing] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les données de la colocation active
  const fetchData = useCallback(async () => {
    if (!currentColoc?.id) {
      setBalances([]);
      setDebts([]);
      setExpenses([]);
      setTotalColocExpenses(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/members?colocId=${currentColoc.id}`);
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances || []);
        setDebts(data.debts || []);
        setExpenses(data.expenses || []);
        setTotalColocExpenses(data.totalColocExpenses || 0);
      }
    } catch (err) {
      console.error('Erreur chargement données:', err);
    } finally {
      setLoading(false);
    }
  }, [currentColoc?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Déclenchement dès qu'un fichier est sélectionné (appareil photo ou galerie)
  const handleFileSelected = (file: File) => {
    setSelectedImage(file);
    setManualInitialData(null);
    setViewState('review');
  };

  // Saisie manuelle
  const handleManualEntry = () => {
    setShowManualModal(true);
  };

  const handleExpenseSaved = () => {
    setViewState('dashboard');
    setSelectedImage(null);
    setManualInitialData(null);
    fetchData();
  };

  // Vider les dépenses
  const handleClearAll = async () => {
    if (!confirm('Voulez-vous vider toutes les dépenses de la colocation pour repartir à zéro ?')) {
      return;
    }
    setClearing(true);
    try {
      const url = currentColoc?.id
        ? `/api/expenses?clearAll=true&colocId=${currentColoc.id}`
        : '/api/expenses?clearAll=true';
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  // Régler une dette
  const handleSettleDebt = async (debt: Debt) => {
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMemberId: debt.from.id,
          toMemberId: debt.to.id,
          amount: debt.amount,
          colocationId: currentColoc?.id || null,
          notes: `Règlement de ${debt.from.name} à ${debt.to.name}`,
        }),
      });
      if (res.ok) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const myBalance = balances.find((b) => b.member.id === currentMember?.id);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Inputs cachés pour déclencher immédiatement la caméra */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
      />

      {/* VUE 1 : ZERO-WAIT REVIEW FLOW */}
      {viewState === 'review' && (
        <ZeroWaitReview
          imageFile={selectedImage}
          initialData={manualInitialData}
          onCancel={() => {
            setViewState('dashboard');
            setSelectedImage(null);
            setManualInitialData(null);
          }}
          onSaved={handleExpenseSaved}
        />
      )}

      {/* VUE 2 : DASHBOARD PRINCIPAL ULTRA-ÉPURÉ */}
      {viewState === 'dashboard' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Carte Solde Personnelle */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-xl shadow-emerald-900/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold">
                <span className="text-xl">{currentMember?.avatar || '👤'}</span>
                <span className="text-sm">{currentMember?.name || 'Mon profil'}</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider">
                Pot : {totalColocExpenses.toFixed(2)} €
              </span>
            </div>

            <div className="mt-4">
              <span className="text-xs text-emerald-200/90 font-medium">Ton solde actuel</span>
              <div className="text-4xl font-black tracking-tight mt-0.5">
                {myBalance ? (
                  <>
                    {myBalance.netBalance > 0.01 && '+'}
                    {myBalance.netBalance.toFixed(2)} €
                  </>
                ) : (
                  '0.00 €'
                )}
              </div>
              <p className="mt-1 text-xs text-emerald-100/90">
                {myBalance?.netBalance && myBalance.netBalance > 0.01
                  ? 'La coloc te doit de l\'argent'
                  : myBalance?.netBalance && myBalance.netBalance < -0.01
                  ? 'Tu as des remboursements en attente'
                  : 'Tes comptes sont parfaitement équilibrés'}
              </p>
            </div>
          </div>

          {/* GROS BOUTON UNIQUE CAMÉRA */}
          <div className="space-y-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 p-4 text-base font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-[0.98] transition-all"
            >
              <Camera className="h-6 w-6" />
              <span>Scanner un ticket de caisse</span>
            </button>

            {/* Raccourcis discrets */}
            <div className="flex items-center justify-center gap-4 text-xs font-semibold text-gray-500 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:text-emerald-700 inline-flex items-center gap-1"
              >
                <Upload className="h-3.5 w-3.5" /> Importer image / PDF
              </button>
              <span>•</span>
              <button
                onClick={handleManualEntry}
                className="hover:text-emerald-700 inline-flex items-center gap-1"
              >
                <Edit3 className="h-3.5 w-3.5" /> Saisie manuelle
              </button>
            </div>
          </div>

          {/* Onglets Dépenses vs Équilibre */}
          <div className="flex border-b border-gray-200 pt-2">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'expenses'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              Dépenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'balances'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              Soldes & Remboursements {debts.length > 0 && `(${debts.length})`}
            </button>
          </div>

          {/* Onglet 1 : Dépenses */}
          {activeTab === 'expenses' && (
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-gray-50/80 border border-dashed border-gray-200 space-y-1">
                  <Receipt className="h-8 w-8 mx-auto text-gray-300" />
                  <p className="text-xs font-bold text-gray-600">Aucune dépense enregistrée</p>
                  <p className="text-[11px] text-gray-400">
                    Prenez en photo votre premier ticket de courses !
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xl">
                          {e.payer.avatar}
                        </span>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-gray-900">
                            {e.store || e.title}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            Par {e.payer.name} • {new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-black text-gray-900">
                          {e.totalAmount.toFixed(2)} €
                        </div>
                        <div className="flex gap-1 justify-end mt-0.5">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Coloc: {e.colocAmount.toFixed(2)}€
                          </span>
                          {e.persoAmount > 0 && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              Perso: {e.persoAmount.toFixed(2)}€
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {expenses.length > 0 && (
                    <div className="pt-4 text-center">
                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={clearing}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {clearing ? 'Nettoyage...' : 'Réinitialiser toutes les dépenses'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Onglet 2 : Soldes & Remboursements */}
          {activeTab === 'balances' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                  Soldes de la coloc
                </span>
                {balances.map((b) => (
                  <div
                    key={b.member.id}
                    className="flex items-center justify-between py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{b.member.avatar}</span>
                      <span className="font-bold text-gray-800">{b.member.name}</span>
                    </div>
                    <span
                      className={`font-black px-2 py-0.5 rounded-full ${
                        b.netBalance > 0.01
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.netBalance < -0.01
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {b.netBalance > 0.01 ? '+' : ''}
                      {b.netBalance.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                  Virements conseillés
                </span>
                {debts.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 p-3 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Tout le monde est quitte !</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {debts.map((d, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/70 p-3"
                      >
                        <div className="text-xs">
                          <span className="font-bold text-gray-800">
                            {d.from.name} ➔ {d.to.name}
                          </span>
                          <div className="text-[11px] text-gray-500">
                            doit <strong className="text-gray-900">{d.amount.toFixed(2)} €</strong>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSettleDebt(d)}
                          className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black active:scale-95 transition-all"
                        >
                          Régler
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showManualModal && (
        <ManualExpenseModal
          onClose={() => setShowManualModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
