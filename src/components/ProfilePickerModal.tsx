'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { UserPlus, Check, Trash2, Edit2, X } from 'lucide-react';
import { Member } from '@/types';

export default function ProfilePickerModal() {
  const { currentMember, members, setCurrentMember, isPickerOpen, setIsPickerOpen, refreshMembers } = useProfile();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [nameInput, setNameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('😎');
  const [colorInput, setColorInput] = useState('#10b981');
  const [loading, setLoading] = useState(false);

  // Si pas de membres dans la colocation, ouvrir automatiquement le formulaire d'ajout
  const isFormOpen = showAddForm || Boolean(editingMember) || members.length === 0;

  if (!isPickerOpen && currentMember) return null;

  const emojiOptions = ['🥑', '🦊', '🎨', '🍕', '🎸', '🐱', '🚀', '☕', '🌟', '🎧', '😎', '🦁'];
  const colorOptions = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const startEdit = (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMember(m);
    setNameInput(m.name);
    setAvatarInput(m.avatar);
    setColorInput(m.color);
  };

  const startAdd = () => {
    setEditingMember(null);
    setNameInput('');
    setAvatarInput('😎');
    setColorInput('#10b981');
    setShowAddForm(true);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingMember(null);
    setNameInput('');
  };

  const handleDeleteMember = async (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Supprimer définitivement le profil "${m.name}" ?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/members?id=${m.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erreur lors de la suppression');
        return;
      }

      const remaining = members.filter((item) => item.id !== m.id);
      if (currentMember?.id === m.id) {
        if (remaining.length > 0) {
          setCurrentMember(remaining[0]);
        } else {
          // Plus aucun membre : forcer l'ajout
          localStorage.removeItem('coloc_active_profile_id');
          await refreshMembers();
          setShowAddForm(true);
          return;
        }
      }
      await refreshMembers();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setLoading(true);
    try {
      if (editingMember) {
        // Modification PUT
        const res = await fetch('/api/members', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingMember.id,
            name: nameInput.trim(),
            avatar: avatarInput,
            color: colorInput,
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          await refreshMembers();
          if (currentMember?.id === updated.id) {
            setCurrentMember(updated);
          }
          cancelForm();
        }
      } else {
        // Création POST
        const res = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.trim(),
            avatar: avatarInput,
            color: colorInput,
          }),
        });

        if (res.ok) {
          const created = await res.json();
          await refreshMembers();
          setCurrentMember(created);
          cancelForm();
        }
      }
    } catch (err) {
      console.error('Erreur enregistrement coloc:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl shadow-inner">
            🏠
          </div>
          <h2 className="mt-3 text-2xl font-black text-gray-900">
            {editingMember
              ? 'Modifier le profil'
              : showAddForm
              ? 'Nouveau colocataire'
              : currentMember
              ? 'Changer de profil'
              : 'Bienvenue dans la Coloc !'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isFormOpen
              ? 'Personnalisez le prénom, l’avatar et la couleur.'
              : 'Sélectionnez votre profil ou gérez les colocataires.'}
          </p>
        </div>

        {!isFormOpen ? (
          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
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
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-2xl shadow-sm border border-gray-100">
                        {m.avatar}
                      </span>
                      <div>
                        <div className="font-bold text-gray-800 text-base">{m.name}</div>
                        <div className="text-xs text-gray-400">
                          {isSelected ? 'Actif sur ce téléphone' : 'Colocataire'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSelected && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow mr-1">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => startEdit(m, e)}
                        title="Modifier ce profil"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-white transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteMember(m, e)}
                        title="Supprimer ce profil"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={startAdd}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Ajouter un nouveau colocataire
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveMember} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Prénom du coloc
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Ex: Maxime, Sophie..."
                required
                autoFocus
                className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
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
                    className={`h-10 w-10 rounded-xl text-xl flex items-center justify-center transition-all ${
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
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !nameInput.trim()}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {loading
                  ? 'Enregistrement...'
                  : editingMember
                  ? 'Mettre à jour'
                  : 'Rejoindre la coloc 🚀'}
              </button>
            </div>
          </form>
        )}

        {currentMember && !isFormOpen && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsPickerOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Fermer sans changer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
