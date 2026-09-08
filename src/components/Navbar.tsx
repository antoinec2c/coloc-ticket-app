'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/context/ProfileContext';
import { Receipt, Users, Settings, Plus, Sparkles, RefreshCw } from 'lucide-react';
import SettingsModal from './SettingsModal';

export default function Navbar() {
  const { currentMember, setIsPickerOpen } = useProfile();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo & Titre */}
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-gray-900 text-lg">Coloc<span className="text-emerald-600">Pot</span></span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">IA</span>
              </div>
              <p className="text-[11px] font-medium text-gray-400">Tickets & Pot Commun</p>
            </div>
          </Link>

          {/* Profil actif & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Bouton Changer de colocataire */}
            <button
              onClick={() => setIsPickerOpen(true)}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50/80 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-95"
              title="Changer de profil coloc"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base shadow-inner border border-gray-100">
                {currentMember?.avatar || '👤'}
              </span>
              <span className="hidden sm:inline font-bold text-gray-900">
                {currentMember?.name || 'Sélectionner'}
              </span>
              <RefreshCw className="h-3 w-3 text-gray-400" />
            </button>

            {/* Bouton Paramètres */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              title="Paramètres de l'application & Clé API"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
