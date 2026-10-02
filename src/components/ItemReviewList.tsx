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
  Users,
  X,
  Check,
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
      assignedMemberIds: it.assignedMemberIds,
    }))
  );

  // Payeur par défaut = membre actuellement connecté
  const [payerId, setPayerId] = useState<string>(
    currentMember?.id || members[0]?.id || ''
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Sélecteur de colocataires pour un article ou par lot
  const [memberPickerItem, setMemberPickerItem] = useState<ExpenseItem | null>(null);
  const [tempSelectedMemberIds, setTempSelectedMemberIds] = useState<string[]>([]);
  const [isBatchPicker, setIsBatchPicker] = useState<boolean>(false);

  const openMemberPicker = (item: ExpenseItem) => {
    setIsBatchPicker(false);
    setMemberPickerItem(item);
    const validAssigned = (item.assignedMemberIds || []).filter((id) => members.some((m) => m.id === id));
    if (validAssigned.length > 0) {
      setTempSelectedMemberIds([...validAssigned]);
    } else if (item.isPersonal) {
      setTempSelectedMemberIds([payerId]);
    } else {
      setTempSelectedMemberIds(members.map((m) => m.id));
    }
  };

  const openBatchMemberPicker = () => {
    setIsBatchPicker(true);
    setMemberPickerItem(null);
    setTempSelectedMemberIds(members.map((m) => m.id));
  };

  const toggleMemberInPicker = (memberId: string) => {
    setTempSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveMemberPicker = () => {
    if (tempSelectedMemberIds.length === 0) return;

    if (isBatchPicker) {
      const isAll = tempSelectedMemberIds.length === members.length;
      const isOnlyPayer = tempSelectedMemberIds.length === 1 && tempSelectedMemberIds[0] === payerId;

      setItems((prev) =>
        prev.map((it) => {
          if (isAll) {
            return { ...it, isPersonal: false, assignedMemberIds: undefined };
          }
          if (isOnlyPayer) {
            return { ...it, isPersonal: true, assignedMemberIds: undefined };
          }
          return { ...it, isPersonal: false, assignedMemberIds: tempSelectedMemberIds };
        })
      );
      setIsBatchPicker(false);
      return;
    }

    if (!memberPickerItem) return;

    const isAll = tempSelectedMemberIds.length === members.length;
    const isOnlyPayer = tempSelectedMemberIds.length === 1 && tempSelectedMemberIds[0] === payerId;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== memberPickerItem.id) return it;
        if (isAll) {
          return { ...it, isPersonal: false, assignedMemberIds: undefined };
        }
        if (isOnlyPayer) {
          return { ...it, isPersonal: true, assignedMemberIds: undefined };
        }
        return { ...it, isPersonal: false, assignedMemberIds: tempSelectedMemberIds };
      })
    );
    setMemberPickerItem(null);
  };

  // Définir l'attribution d'un article de façon atomique
  const setItemAssignment = (id: string, isPersonal: boolean, assignedMemberIds?: string[]) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isPersonal, assignedMemberIds } : it))
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
      prev.map((it) => (matchedIds.includes(it.id) ? { ...it, isPersonal, assignedMemberIds: undefined } : it))
    );
  };

  // Tout passer pour la coloc
  const setAllColoc = () => {
    setItems((prev) => prev.map((it) => ({ ...it, isPersonal: false, assignedMemberIds: undefined })));
  };

  // Tout passer en perso
  const setAllPerso = () => {
    setItems((prev) => prev.map((it) => ({ ...it, isPersonal: true, assignedMemberIds: undefined })));
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

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={setAllColoc}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors"
              title="Passer tous les articles en Coloc"
            >
              Tout Coloc
            </button>
            <button
              onClick={setAllPerso}
              className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors"
              title="Passer tous les articles en Perso"
            >
              Tout Perso
            </button>
            <button
              onClick={openBatchMemberPicker}
              className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              title="Attribuer tous les articles à des colocataires précis"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Certains</span>
            </button>
            <button
              onClick={addItem}
              className="flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* Liste des lignes d'articles */}
        <div className="space-y-2.5">
          {items.map((item) => {
            const validAssigned = item.assignedMemberIds?.filter((id) => members.some((m) => m.id === id));
            const isCustom = !item.isPersonal && Boolean(validAssigned && validAssigned.length > 0 && validAssigned.length < members.length);
            const isAll = !item.isPersonal && !isCustom;
            const isPerso = Boolean(item.isPersonal);

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2.5 rounded-2xl border p-3 transition-all ${
                  isPerso
                    ? 'border-blue-200 bg-blue-50/50 shadow-sm'
                    : isCustom
                    ? 'border-purple-200 bg-purple-50/50 shadow-sm'
                    : 'border-emerald-200 bg-emerald-50/30'
                }`}
              >
                {/* Ligne 1 : Nom de l'article (éditable) & Prix */}
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="flex-1 min-w-0 space-y-1">
                    <textarea
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      rows={Math.max(1, Math.min(3, Math.ceil((item.name || '').length / 28)))}
                      className="w-full resize-none font-bold text-xs sm:text-sm text-gray-900 bg-transparent focus:outline-none focus:border-b border-emerald-400 break-words leading-snug [field-sizing:content]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                      <span className="rounded-md bg-white/80 px-2 py-0.5 font-medium border border-gray-200">
                        {item.category || 'Alimentation'}
                      </span>
                      <span>
                        {item.quantity} x {item.unitPrice.toFixed(2)} €
                      </span>
                    </div>

                    {isCustom && validAssigned && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-lg border border-purple-200 mt-1 w-fit max-w-full">
                        <span>👥 Pour :</span>
                        <span className="break-words">
                          {members
                            .filter((m) => validAssigned.includes(m.id))
                            .map((m) => m.name)
                            .join(', ') || `${validAssigned.length} colocs`}
                        </span>
                        <span className="text-purple-600 font-semibold ml-1 shrink-0">
                          ({(item.totalPrice / validAssigned.length).toFixed(2)} €/p)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm sm:text-base font-black text-gray-900">
                      {item.totalPrice.toFixed(2)} €
                    </span>
                  </div>
                </div>

                {/* Ligne 2 : Sélecteur tactile Coloc / Perso / Certains & Supprimer */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100/80">
                  {/* Sélecteur tactile Coloc / Perso / Certains */}
                  <div className="flex-1 min-w-0 flex rounded-xl bg-white p-0.5 shadow-xs border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setItemAssignment(item.id, false, undefined)}
                      className={`flex-1 py-1.5 px-1.5 sm:px-2 text-center rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        isAll
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-emerald-700'
                      }`}
                    >
                      <span>🟢</span>
                      <span>Coloc</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemAssignment(item.id, true, undefined)}
                      className={`flex-1 py-1.5 px-1.5 sm:px-2 text-center rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        isPerso
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-blue-700'
                      }`}
                    >
                      <span>🔵</span>
                      <span>Perso</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openMemberPicker(item)}
                      className={`flex-1 py-1.5 px-1.5 sm:px-2 text-center rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        isCustom
                          ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-300'
                          : 'text-gray-500 hover:text-purple-700'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{isCustom ? `${validAssigned?.length}` : 'Certains'}</span>
                    </button>
                  </div>

                  {/* Supprimer article */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                    title="Supprimer cette ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
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
              {items.some((it) => !it.isPersonal && it.assignedMemberIds && it.assignedMemberIds.length > 0 && it.assignedMemberIds.length < members.length)
                ? 'Ventilation sur-mesure selon les articles'
                : `Soit ${(colocTotal / (members.length || 1)).toFixed(2)} € / coloc`}
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

      {/* MODAL DE SÉLECTION DES COLOCATAIRES PAR ARTICLE OU PAR LOT */}
      {(memberPickerItem || isBatchPicker) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => {
            setMemberPickerItem(null);
            setIsBatchPicker(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl transition-all space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-gray-900 break-words">
                    {isBatchPicker ? 'Attribuer tous les articles' : 'Qui participe à cet article ?'}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-semibold break-words">
                    {isBatchPicker
                      ? `${items.length} articles • ${items.reduce((s, it) => s + it.totalPrice, 0).toFixed(2)} €`
                      : `${memberPickerItem?.name} • ${memberPickerItem?.totalPrice.toFixed(2)} €`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMemberPickerItem(null);
                  setIsBatchPicker(false);
                }}
                className="rounded-xl p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Raccourcis rapides */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTempSelectedMemberIds(members.map((m) => m.id))}
                className="flex-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 py-1.5 text-xs font-bold text-emerald-800 transition-colors"
              >
                🟢 Toute la coloc
              </button>
              <button
                type="button"
                onClick={() => setTempSelectedMemberIds([payerId])}
                className="flex-1 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 py-1.5 text-xs font-bold text-blue-800 transition-colors"
              >
                🔵 {payerId === currentMember?.id ? 'Moi seul' : `${members.find((m) => m.id === payerId)?.name || 'Payeur'} seul`}
              </button>
            </div>

            {/* Liste des colocataires */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {members.map((m) => {
                const isChecked = tempSelectedMemberIds.includes(m.id);
                const isPayer = m.id === payerId;
                const activeTotal = isBatchPicker
                  ? items.reduce((s, it) => s + it.totalPrice, 0)
                  : memberPickerItem?.totalPrice || 0;
                const share =
                  tempSelectedMemberIds.length > 0 && isChecked
                    ? activeTotal / tempSelectedMemberIds.length
                    : null;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMemberInPicker(m.id)}
                    className={`w-full flex items-center justify-between rounded-2xl border p-2.5 text-left transition-all ${
                      isChecked
                        ? 'border-purple-400 bg-purple-50/60 shadow-xs'
                        : 'border-gray-200 bg-gray-50/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{m.avatar}</span>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">
                          {m.name} {isPayer ? '(Payeur)' : ''}
                        </span>
                        {share !== null && (
                          <span className="text-[10px] font-semibold text-purple-700">
                            Sa part : {share.toFixed(2)} €
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${
                        isChecked
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMemberPickerItem(null);
                  setIsBatchPicker(false);
                }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveMemberPicker}
                disabled={tempSelectedMemberIds.length === 0}
                className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
              >
                Valider ({tempSelectedMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
