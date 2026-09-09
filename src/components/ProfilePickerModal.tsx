'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { UserPlus, Check, Trash2, Edit2, Home, KeyRound, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { Member } from '@/types';

export default function ProfilePickerModal() {
  const {
    currentColoc,
    currentMember,
    members,
    setCurrentMember,
    isPickerOpen,
    setIsPickerOpen,
    createColoc,
    joinColocByCode,
    leaveOrSwitchColoc,
    createMember,
    updateMember,
    deleteMember,
  } = useProfile();

  // Mode Colocation : 'create' | 'join'
  const [colocMode, setColocMode] = useState<'create' | 'join'>('create');
  const [colocNameInput, setColocNameInput] = useState('');
  const [colocCodeInput, setColocCodeInput] = useState('');

  // Mode Membre : ajout / édition
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('😎');
  const [colorInput, setColorInput] = useState('#10b981');

  // États UI
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emojiOptions = ['🥑', '🦊', '🎨', '🍕', '🎸', '🐱', '🚀', '☕', '🌟', '🎧', '😎', '🦁'];
  const colorOptions = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Ne pas afficher le modal si fermé et profil actif configuré
  if (!isPickerOpen && currentMember && currentColoc) return null;

  // --- ACTIONS COLOCATION ---
  const handleCreateColoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colocNameInput.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      await createColoc(colocNameInput.trim());
      setColocNameInput('');
      setShowAddForm(true); // inviter à créer son premier colocataire
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la création de la colocation');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinColoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colocCodeInput.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      await joinColocByCode(colocCodeInput.trim());
      setColocCodeInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Code de colocation introuvable');
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS MEMBRES ---
  const startEdit = (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMember(m);
    setNameInput(m.name);
    setAvatarInput(m.avatar);
    setColorInput(m.color);
    setErrorMessage(null);
  };

  const startAdd = () => {
    setEditingMember(null);
    setNameInput('');
    setAvatarInput('😎');
    setColorInput('#10b981');
    setShowAddForm(true);
    setErrorMessage(null);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingMember(null);
    setNameInput('');
    setErrorMessage(null);
  };

  const handleDeleteMember = async (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer définitivement le profil "${m.name}" ?`)) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      await deleteMember(m.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setErrorMessage('Veuillez renseigner un prénom');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      if (editingMember) {
        await updateMember(editingMember.id, nameInput.trim(), avatarInput, colorInput);
      } else {
        await createMember(nameInput.trim(), avatarInput, colorInput);
      }
      cancelForm();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  // Formulaire de membre affiché si : demandé, ou en cours d'édition, ou 0 membres dans la coloc
  const isMemberFormOpen = showAddForm || Boolean(editingMember) || members.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all">

        {/* ======================================================== */}
        {/* ÉTAPE 1 : AUCUNE COLOCATION SÉLECTIONNÉE                 */}
        {/* ======================================================== */}
        {!currentColoc ? (
          <div>
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl shadow-inner">
                🏠
              </div>
              <h2 className="mt-3 text-2xl font-black text-gray-900">
                Bienvenue sur ColocPot !
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Pour isoler vos comptes de ceux des autres colocations, commencez par créer ou rejoindre la vôtre.
              </p>
            </div>

            {/* Onglets Créer / Rejoindre */}
            <div className="mt-5 flex rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => { setColocMode('create'); setErrorMessage(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                  colocMode === 'create'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Créer une coloc
              </button>
              <button
                type="button"
                onClick={() => { setColocMode('join'); setErrorMessage(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                  colocMode === 'join'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Rejoindre avec un code
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                ⚠️ {errorMessage}
              </div>
            )}

            {colocMode === 'create' ? (
              <form onSubmit={handleCreateColoc} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Nom de votre colocation
                  </label>
                  <input
                    type="text"
                    value={colocNameInput}
                    onChange={(e) => setColocNameInput(e.target.value)}
                    placeholder="Ex: Coloc Gambetta, Les Lilas..."
                    required
                    autoFocus
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Un code d'invitation court sera généré pour inviter vos colocataires.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !colocNameInput.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.99]"
                >
                  {loading ? 'Création en cours...' : 'Créer ma colocation 🚀'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinColoc} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Code d'invitation
                  </label>
                  <input
                    type="text"
                    value={colocCodeInput}
                    onChange={(e) => setColocCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ex: GAMB-482 ou LILAS-712"
                    required
                    autoFocus
                    className="mt-1 w-full uppercase tracking-wider font-mono rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Entrez le code partagé par votre colocataire ou reçu par message.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !colocCodeInput.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.99]"
                >
                  {loading ? 'Recherche...' : 'Rejoindre cette coloc 🔑'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* ÉTAPE 2 : COLOCATION ACTIVE -> SÉLECTION DU MEMBRE       */
          /* ======================================================== */
          <div>
            {/* Header Coloc */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-black text-sm">
                  🏠
                </span>
                <div>
                  <h3 className="text-sm font-black text-gray-900">{currentColoc.name}</h3>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                    <span>Code :</span>
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{currentColoc.code}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={leaveOrSwitchColoc}
                className="text-[11px] font-semibold text-gray-400 hover:text-emerald-700 transition-colors"
                title="Changer de colocation"
              >
                Changer de coloc
              </button>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-black text-gray-900">
                {editingMember
                  ? 'Modifier le profil'
                  : isMemberFormOpen && members.length === 0
                  ? 'Ajoute ton profil coloc'
                  : showAddForm
                  ? 'Nouveau colocataire'
                  : 'Qui utilise ce téléphone ?'}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {isMemberFormOpen
                  ? 'Choisis ton prénom, ton avatar et ta couleur.'
                  : 'Sélectionne ton profil pour attribuer tes dépenses et tes soldes.'}
              </p>
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 border border-rose-200">
                ⚠️ {errorMessage}
              </div>
            )}

            {!isMemberFormOpen ? (
              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                  {members.map((m) => {
                    const isSelected = currentMember?.id === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setCurrentMember(m)}
                        className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all active:scale-[0.99] ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-400/30'
                            : 'border-gray-200 bg-gray-50/60 hover:border-gray-300 hover:bg-gray-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-2xl shadow-sm border border-gray-100">
                            {m.avatar}
                          </span>
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{m.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {isSelected ? 'Actif sur ce téléphone' : 'Colocataire'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow mr-1">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => startEdit(m, e)}
                            title="Modifier ce profil"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-white transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteMember(m, e)}
                            title="Supprimer ce profil"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={startAdd}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-xs font-bold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Ajouter un nouveau colocataire
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveMember} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Prénom du colocataire
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Ex: Maxime, Sophie, Antoine..."
                    required
                    autoFocus
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Avatar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {emojiOptions.map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => setAvatarInput(emo)}
                        className={`h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                          avatarInput === emo
                            ? 'bg-emerald-100 ring-2 ring-emerald-500 scale-110 shadow-sm'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Couleur de badge
                  </label>
                  <div className="flex gap-2.5">
                    {colorOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColorInput(c)}
                        className={`h-7 w-7 rounded-full transition-all ${
                          colorInput === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {members.length > 0 && (
                    <button
                      type="button"
                      onClick={cancelForm}
                      className="flex-1 rounded-xl border border-gray-300 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !nameInput.trim()}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-[0.99]"
                  >
                    {loading
                      ? 'Enregistrement...'
                      : editingMember
                      ? 'Mettre à jour'
                      : 'Enregistrer mon profil ✨'}
                  </button>
                </div>
              </form>
            )}

            {currentMember && !isMemberFormOpen && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
