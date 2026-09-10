'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { Key, Users, X, Check, ExternalLink, Home, Share2, LogOut } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const {
    apiKey,
    setApiKey,
    currentColoc,
    leaveOrSwitchColoc,
    members,
    createMember,
  } = useProfile();

  const [keyInput, setKeyInput] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  React.useEffect(() => {
    if (apiKey) {
      setKeyInput(apiKey);
    }
  }, [apiKey]);

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('🍕');
  const [loadingMember, setLoadingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(keyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCopyInviteLink = () => {
    if (!currentColoc) return;
    const url = `${window.location.origin}/?join=${currentColoc.code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    setLoadingMember(true);
    setMemberError(null);
    try {
      await createMember(newMemberName.trim(), newMemberAvatar, '#3b82f6');
      setNewMemberName('');
    } catch (err: any) {
      setMemberError(err.message || 'Erreur lors de l\'ajout du colocataire');
    } finally {
      setLoadingMember(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            ⚙️ Paramètres
          </h3>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1 : Colocation Active */}
        {currentColoc && (
          <div className="mt-5 rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm border border-emerald-200/50">
                  🏠
                </span>
                <div>
                  <h4 className="font-black text-gray-900 text-sm">{currentColoc.name}</h4>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                    <span>Code d'invitation :</span>
                    <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800">
                      {currentColoc.code}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white border border-emerald-200 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100/50 transition-colors shadow-sm"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                {copiedLink ? 'Lien WhatsApp copié !' : 'Copier le lien d\'invitation'}
              </button>

              <button
                type="button"
                onClick={() => {
                  leaveOrSwitchColoc();
                  onClose();
                }}
                className="flex items-center justify-center gap-1 rounded-xl bg-gray-100 border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                title="Changer de colocation ou en créer une autre"
              >
                <LogOut className="h-3.5 w-3.5" />
                Changer
              </button>
            </div>
          </div>
        )}

        {/* Section 2 : Colocataires */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Colocataires de la coloc ({members.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 rounded-xl border border-gray-100 p-2.5 bg-gray-50/60"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg shadow-sm border border-gray-100">
                  {m.avatar}
                </span>
                <span className="font-bold text-xs text-gray-800">{m.name}</span>
              </div>
            ))}
          </div>

          {memberError && (
            <p className="text-xs font-bold text-rose-600">⚠️ {memberError}</p>
          )}

          {/* Formulaire ajout colocataire */}
          <form onSubmit={handleAddMember} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Prénom du nouveau coloc..."
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              disabled={loadingMember || !newMemberName.trim()}
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {loadingMember ? 'Ajout...' : 'Ajouter'}
            </button>
          </form>
        </div>

        {/* Section 3 : Clé API Gemini */}
        <div className="mt-6 border-t border-gray-100 pt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <Key className="h-4 w-4 text-emerald-600" />
            <span>Clé d'API Google Gemini</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Utilisée pour la lecture OCR intelligente des tickets froissés ou mal cadrés.
          </p>

          <form onSubmit={handleSaveKey} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Clé API Gemini (AQ... ou AIza...)"
                className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-black transition-colors"
              >
                Sauvegarder
              </button>
            </div>
            {savedSuccess && (
              <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Clé enregistrée !
              </p>
            )}
          </form>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
