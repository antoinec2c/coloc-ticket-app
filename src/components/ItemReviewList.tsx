'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { ExpenseItem, ExtractedReceipt } from '@/types';
import VoiceAssistant from './VoiceAssistant';
import {
  CheckCircle2,
  Trash2,
  Plus,
  ArrowLeft,
  Store,
  Calendar,
  Layers,
  Sparkles,
  DollarSign,
  User,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  initialData: ExtractedReceipt;
  previewUrl: string | null;
  onCancel: () => void;
  onSaved: () => void;
}

export default function ItemReviewList({
  initialData,
  previewUrl,
  onCancel,
  onSaved,
}: Props) {
  const { currentMember, members } = useProfile();

  const [store, setStore] = useState(initialData.store || 'Supermarché');
  const [date, setDate] = useState(initialData.date || new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ExpenseItem[]>(
    (initialData.items || []).map((it, idx) => ({
      id: `item-${idx}-${Date.now()}`,
      name: it.name,
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || it.totalPrice || 0,
      totalPrice: it.totalPrice || 0,
      isPersonal: it.isPersonal ?? false, // 100% Coloc par défaut
      category: it.category || 'Alimentation',
    }))
  );

  // Payeur par défaut = membre actuellement connecté
  const [payerId, setPayerId] = useState<string>(
    currentMember?.id || members[0]?.id || ''
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Basculer un article entre Coloc et Perso
  const toggleItemPersonal = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isPersonal: !it.isPersonal } : it))
    );
  };

  // Mettre à jour un article
  const updateItem = (id: string, field: keyof ExpenseItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.totalPrice = Math.round(Number(updated.quantity) * Number(updated.unitPrice) * 100) / 100;
          }
          return updated;
        }
        return it;
      })
    );
  };

  // Supprimer un article
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Ajouter un article manquant
  const addItem = () => {
    const newItem: ExpenseItem = {
      id: `item-new-${Date.now()}`,
      name: 'Nouvel article',
      quantity: 1,
      unitPrice: 1.0,
      totalPrice: 1.0,
      isPersonal: false,
      category: 'Alimentation',
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Action vocale : mise à jour des articles détectés
  const handleVoiceAllocated = (
    matchedIds: string[],
    action: 'set_personal' | 'set_coloc'
  ) => {
    const isPersonal = action === 'set_personal';
    setItems((prev) =>
      prev.map((it) => (matchedIds.includes(it.id) ? { ...it, isPersonal } : it))
    );
  };

  // Tout passer pour la coloc
  const setAllColoc = () => {
    setItems((prev) => prev.map((it) => ({ ...it, isPersonal: false })));
  };

  // Calculs dynamiques des totaux
  const colocTotal = Math.round(
    items.filter((it) => !it.isPersonal).reduce((acc, it) => acc + it.totalPrice, 0) * 100
  ) / 100;

  const persoTotal = Math.round(
    items.filter((it) => it.isPersonal).reduce((acc, it) => acc + it.totalPrice, 0) * 100
  ) / 100;

  const totalTicket = Math.round((colocTotal + persoTotal) * 100) / 100;

  // Soumission finale
  const handleSaveExpense = async () => {
    if (!payerId) {
      alert('Veuillez sélectionner qui a avancé les frais.');
      return;
    }
    if (items.length === 0) {
      alert('Il faut au moins un article dans la dépense.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Courses - ${store}`,
          store,
          date,
          payerId,
          items,
          fileType: 'receipt_photo',
          receiptImage: previewUrl,
          notes,
        }),
      });

      if (res.ok) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
        onSaved();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la sauvegarde.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* En-tête avec bouton retour */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au scanner
        </button>

        {previewUrl && (
          <button
            onClick={() => setShowImagePreview(!showImagePreview)}
            className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            {showImagePreview ? 'Masquer photo du ticket' : 'Voir photo du ticket original'}
          </button>
        )}
      </div>

      {/* Aperçu photo escamotable */}
      {showImagePreview && previewUrl && (
        <div className="rounded-2xl border border-gray-200 bg-gray-900 p-2 max-h-80 flex items-center justify-center overflow-hidden">
          <img src={previewUrl} alt="Ticket original" className="max-h-76 object-contain" />
        </div>
      )}

      {/* Mode Vocal Flemmard */}
      <VoiceAssistant items={items} onItemsAllocated={handleVoiceAllocated} />

      {/* Métadonnées : Magasin, Date, Payeur */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Magasin / Fournisseur
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2">
            <Store className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Date du ticket
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Qui a avancé les frais ?
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-2 py-1.5">
            <User className="h-4 w-4 text-gray-400" />
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-gray-900 focus:outline-none"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.avatar} {m.name} {m.id === currentMember?.id ? '(Moi)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau interactif des articles */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              Articles extraits ({items.length})
            </h3>
            <p className="text-xs text-gray-500">
              Tous les articles sont pour la coloc par défaut. Basculez en "Perso" vos achats individuels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={setAllColoc}
              className="text-xs font-semibold text-gray-600 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Tout en Coloc
            </button>
            <button
              onClick={addItem}
              className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter article
            </button>
          </div>
        </div>

        {/* Liste des lignes d'articles */}
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                item.isPersonal
                  ? 'border-blue-200 bg-blue-50/50 shadow-sm'
                  : 'border-emerald-200 bg-emerald-50/30'
              }`}
            >
              {/* Infos article (Nom + Catégorie) */}
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                  className="w-full font-bold text-xs sm:text-sm text-gray-900 bg-transparent focus:outline-none focus:border-b border-emerald-400"
                />
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="rounded-md bg-white/80 px-2 py-0.5 font-medium border border-gray-200">
                    {item.category || 'Alimentation'}
                  </span>
                  <span>
                    {item.quantity} x {item.unitPrice.toFixed(2)} €
                  </span>
                </div>
              </div>

              {/* Prix & Boutons d'attribution Coloc vs Perso */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                {/* Prix modifiable */}
                <div className="text-right">
                  <span className="text-sm sm:text-base font-black text-gray-900">
                    {item.totalPrice.toFixed(2)} €
                  </span>
                </div>

                {/* Sélecteur tactile Coloc / Perso */}
                <div className="flex rounded-xl bg-white p-1 shadow-sm border border-gray-200">
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, 'isPersonal', false)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      !item.isPersonal
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-emerald-700'
                    }`}
                  >
                    🟢 Coloc
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, 'isPersonal', true)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      item.isPersonal
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-blue-700'
                    }`}
                  >
                    🔵 Perso
                  </button>
                </div>

                {/* Supprimer article */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Supprimer cette ligne"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Résumé de ventilation & Contrôle d'intégrité */}
      <div className="rounded-2xl border border-gray-200/80 bg-gray-900 text-white p-5 shadow-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
          {/* Total Ticket */}
          <div className="rounded-xl bg-white/10 p-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
              Total du Ticket
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {totalTicket.toFixed(2)} €
            </div>
          </div>

          {/* Part Coloc */}
          <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300">
              Part Coloc (Partagée)
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {colocTotal.toFixed(2)} €
            </div>
            <span className="text-[10px] text-emerald-200/80">
              Soit {(colocTotal / (members.length || 1)).toFixed(2)} € / coloc
            </span>
          </div>

          {/* Part Perso */}
          <div className="rounded-xl bg-blue-500/20 border border-blue-500/40 p-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-300">
              Part Perso (Non partagée)
            </span>
            <div className="text-2xl font-black text-blue-400 mt-1">
              {persoTotal.toFixed(2)} €
            </div>
            <span className="text-[10px] text-blue-200/80">
              Payée intégralement par le payeur
            </span>
          </div>
        </div>

        {/* Indicateur d'intégrité */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>Répartition 100% cohérente : Coloc ({colocTotal.toFixed(2)} €) + Perso ({persoTotal.toFixed(2)} €) = {totalTicket.toFixed(2)} €</span>
          </div>
        </div>

        {/* Bouton de validation finale */}
        <button
          onClick={handleSaveExpense}
          disabled={saving || items.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] disabled:opacity-50 transition-all"
        >
          {saving ? 'Enregistrement en cours...' : 'Inscrire au pot commun de la coloc 🚀'}
        </button>
      </div>
    </div>
  );
}
