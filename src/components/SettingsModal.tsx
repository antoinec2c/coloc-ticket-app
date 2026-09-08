'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { Key, Users, X, Check, ExternalLink, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const { apiKey, setApiKey, members, refreshMembers } = useProfile();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newColocName, setNewColocName] = useState('');
  const [newColocAvatar, setNewColocAvatar] = useState('🍕');

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(keyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddColoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColocName.trim()) return;

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColocName.trim(),
          avatar: newColocAvatar,
          color: '#3b82f6',
        }),
      });
      if (res.ok) {
        await refreshMembers();
        setNewColocName('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            ⚙️ Paramètres de la Coloc
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1 : Clé API Gemini (Vision IA) */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <Key className="h-4 w-4 text-emerald-600" />
            <span>Clé d'API Google Gemini (Vision & PDF)</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Gemini Flash est utilisé pour lire les tickets de caisse en <strong>conditions dégradées</strong> (froissés, sombres, pliés) et les factures PDF. Si laissé vide, l'application fonctionne avec les échantillons de test préchargés.
          </p>

          <form onSubmit={handleSaveKey} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Collez votre clé API Gemini (AIza...)"
                className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-colors"
              >
                Sauvegarder
              </button>
            </div>
            {savedSuccess && (
              <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Clé API enregistrée avec succès sur cet appareil !
              </p>
            )}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline pt-1"
            >
              Obtenir une clé API gratuite sur Google AI Studio <ExternalLink className="h-3 w-3" />
            </a>
          </form>
        </div>

        {/* Section 2 : Gestion des colocataires */}
        <div className="mt-8 border-t pt-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Colocataires actuels ({members.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 bg-gray-50/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xl shadow-sm border border-gray-100">
                  {m.avatar}
                </span>
                <span className="font-bold text-sm text-gray-800">{m.name}</span>
              </div>
            ))}
          </div>

          {/* Formulaire ajout coloc */}
          <form onSubmit={handleAddColoc} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newColocName}
              onChange={(e) => setNewColocName(e.target.value)}
              placeholder="Nouveau coloc..."
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newColocName.trim()}
              className="rounded-xl border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              Ajouter
            </button>
          </form>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-black transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
