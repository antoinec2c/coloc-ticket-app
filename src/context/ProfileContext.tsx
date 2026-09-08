'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Member } from '@/types';

interface ProfileContextType {
  currentMember: Member | null;
  members: Member[];
  setCurrentMember: (member: Member) => void;
  switchProfile: (memberId: string) => void;
  refreshMembers: () => Promise<void>;
  isPickerOpen: boolean;
  setIsPickerOpen: (open: boolean) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentMember, setCurrentMemberState] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [apiKey, setApiKeyState] = useState('');

  const refreshMembers = async () => {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);

        // Si aucun profil n'est sélectionné, tenter de restaurer depuis localStorage
        const savedId = localStorage.getItem('coloc_active_profile_id');
        if (savedId) {
          const found = data.members?.find((m: Member) => m.id === savedId);
          if (found) {
            setCurrentMemberState(found);
            return;
          }
        }

        // Si premier lancement et aucun profil sauvegardé, ouvrir le sélecteur
        if (!currentMember && data.members && data.members.length > 0) {
          setIsPickerOpen(true);
        }
      }
    } catch (err) {
      console.error('Erreur chargement membres:', err);
    }
  };

  useEffect(() => {
    refreshMembers();
    const savedKey = localStorage.getItem('coloc_gemini_api_key') || '';
    setApiKeyState(savedKey);
  }, []);

  const setCurrentMember = (member: Member) => {
    setCurrentMemberState(member);
    localStorage.setItem('coloc_active_profile_id', member.id);
    setIsPickerOpen(false);
  };

  const switchProfile = (memberId: string) => {
    const found = members.find((m) => m.id === memberId);
    if (found) {
      setCurrentMember(found);
    }
  };

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('coloc_gemini_api_key', key);
  };

  return (
    <ProfileContext.Provider
      value={{
        currentMember,
        members,
        setCurrentMember,
        switchProfile,
        refreshMembers,
        isPickerOpen,
        setIsPickerOpen,
        apiKey,
        setApiKey,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
