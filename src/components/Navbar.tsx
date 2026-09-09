'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/context/ProfileContext';
import { Receipt, Settings, RefreshCw, Share2, Check, Home } from 'lucide-react';
import SettingsModal from './SettingsModal';

export default function Navbar() {
  const { currentColoc, currentMember, setIsPickerOpen } = useProfile();
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareColoc = () => {
    if (!currentColoc) return;
    const url = `${window.location.origin}/?join=${currentColoc.code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3.5 py-2.5 sm:px-6">
          {/* Logo & Coloc Name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="hidden min-[380px]:block">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold tracking-tight text-gray-900 text-base sm:text-lg">
                    Coloc<span className="text-emerald-600">Pot</span>
                  </span>
                </div>
              </div>
            </Link>

            {/* Badge Colocation Active */}
            {currentColoc && (
              <div className="flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-gray-200">
                <button
                  onClick={() => setIsPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100 transition-colors"
                  title="Gérer la colocation"
                >
                  <Home className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span className="max-w-[100px] sm:max-w-[150px] truncate">{currentColoc.name}</span>
                </button>

                {/* Bouton Partage WhatsApp / Copie Lien */}
                <button
                  type="button"
                  onClick={handleShareColoc}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold border transition-all ${
                    copied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title="Copier le lien d'invitation pour WhatsApp"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span className="hidden sm:inline">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Inviter</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Profil actif & Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Bouton Changer de colocataire */}
            <button
              onClick={() => setIsPickerOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 py-1 pl-1 pr-2.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-95"
              title="Changer de profil coloc"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow-inner border border-gray-100">
                {currentMember?.avatar || '👤'}
              </span>
              <span className="font-bold text-gray-900 text-xs">
                {currentMember?.name || 'Profil'}
              </span>
              <RefreshCw className="h-2.5 w-2.5 text-gray-400" />
            </button>

            {/* Bouton Paramètres */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              title="Paramètres de l'application & Clé API"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
