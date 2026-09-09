'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Member, Colocation } from '@/types';

interface ProfileContextType {
  currentColoc: Colocation | null;
  currentMember: Member | null;
  members: Member[];
  isPickerOpen: boolean;
  setIsPickerOpen: (open: boolean) => void;
  setCurrentMember: (member: Member) => void;
  setCurrentColoc: (coloc: Colocation) => void;
  createColoc: (name: string) => Promise<Colocation>;
  joinColocByCode: (code: string) => Promise<Colocation>;
  leaveOrSwitchColoc: () => void;
  createMember: (name: string, avatar: string, color: string) => Promise<Member>;
  updateMember: (id: string, name: string, avatar: string, color: string) => Promise<Member>;
  deleteMember: (id: string) => Promise<void>;
  refreshMembers: (colocId?: string) => Promise<void>;
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [currentColoc, setCurrentColocState] = useState<Colocation | null>(null);
  const [currentMember, setCurrentMemberState] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [apiKey, setApiKeyState] = useState('');

  const refreshMembers = useCallback(async (colocId?: string) => {
    const targetColocId = colocId || currentColoc?.id;
    try {
      const url = targetColocId ? `/api/members?colocId=${targetColocId}` : '/api/members';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const loadedMembers: Member[] = data.members || [];
        setMembers(loadedMembers);

        if (targetColocId) {
          const savedMemberId = localStorage.getItem(`coloc_active_profile_id_${targetColocId}`);
          if (savedMemberId) {
            const found = loadedMembers.find((m) => m.id === savedMemberId);
            if (found) {
              setCurrentMemberState(found);
              return;
            }
          }
        }

        // Si aucun profil valide sélectionné et des membres existent
        if (!currentMember && loadedMembers.length > 0) {
          setIsPickerOpen(true);
        }
      }
    } catch (err) {
      console.error('Erreur chargement membres:', err);
    }
  }, [currentColoc?.id, currentMember]);

  // Initialisation : URL params & LocalStorage
  useEffect(() => {
    const initApp = async () => {
      // 1. Clé API
      const savedKey = localStorage.getItem('coloc_gemini_api_key') || '';
      setApiKeyState(savedKey);

      // 2. Détection code d'invitation URL (?join=XYZ ou ?coloc=XYZ)
      const urlParams = new URLSearchParams(window.location.search);
      const inviteCode = urlParams.get('join') || urlParams.get('coloc');

      if (inviteCode) {
        try {
          const res = await fetch(`/api/colocs?code=${encodeURIComponent(inviteCode.trim())}`);
          if (res.ok) {
            const colocData = await res.json();
            setCurrentColocState(colocData);
            localStorage.setItem('coloc_active_coloc_id', colocData.id);
            // Nettoyer l'URL
            window.history.replaceState({}, '', window.location.pathname);
            await refreshMembers(colocData.id);
            setIsPickerOpen(true);
            return;
          }
        } catch (e) {
          console.error('Erreur auto-join coloc:', e);
        }
      }

      // 3. Restaurer Colocation depuis localStorage
      const savedColocId = localStorage.getItem('coloc_active_coloc_id');
      if (savedColocId) {
        try {
          const res = await fetch(`/api/colocs?id=${savedColocId}`);
          if (res.ok) {
            const colocData = await res.json();
            setCurrentColocState(colocData);
            await refreshMembers(colocData.id);
            return;
          }
        } catch (e) {
          console.error('Erreur restauration coloc:', e);
        }
      }

      // Si aucune coloc en mémoire, ouvrir le modal d'onboarding
      setIsPickerOpen(true);
    };

    initApp();
  }, [refreshMembers]);

  const setCurrentColoc = (coloc: Colocation) => {
    setCurrentColocState(coloc);
    localStorage.setItem('coloc_active_coloc_id', coloc.id);
    refreshMembers(coloc.id);
  };

  const createColoc = async (name: string): Promise<Colocation> => {
    const res = await fetch('/api/colocs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création de la colocation');
    }

    const created: Colocation = await res.json();
    setCurrentColocState(created);
    setCurrentMemberState(null);
    setMembers([]);
    localStorage.setItem('coloc_active_coloc_id', created.id);
    return created;
  };

  const joinColocByCode = async (code: string): Promise<Colocation> => {
    const res = await fetch(`/api/colocs?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Code colocation introuvable');
    }

    const coloc: Colocation = await res.json();
    setCurrentColocState(coloc);
    localStorage.setItem('coloc_active_coloc_id', coloc.id);
    await refreshMembers(coloc.id);
    return coloc;
  };

  const leaveOrSwitchColoc = () => {
    setCurrentColocState(null);
    setCurrentMemberState(null);
    setMembers([]);
    localStorage.removeItem('coloc_active_coloc_id');
    setIsPickerOpen(true);
  };

  const setCurrentMember = (member: Member) => {
    setCurrentMemberState(member);
    if (currentColoc?.id) {
      localStorage.setItem(`coloc_active_profile_id_${currentColoc.id}`, member.id);
    }
    setIsPickerOpen(false);
  };

  const createMember = async (name: string, avatar: string, color: string): Promise<Member> => {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        avatar,
        color,
        colocationId: currentColoc?.id || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Impossible d\'enregistrer ce colocataire');
    }

    const created: Member = await res.json();
    setMembers((prev) => [...prev, created]);
    setCurrentMember(created);
    return created;
  };

  const updateMember = async (id: string, name: string, avatar: string, color: string): Promise<Member> => {
    const res = await fetch('/api/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, avatar, color }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Impossible de modifier ce colocataire');
    }

    const updated: Member = await res.json();
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (currentMember?.id === updated.id) {
      setCurrentMemberState(updated);
    }
    return updated;
  };

  const deleteMember = async (id: string): Promise<void> => {
    const res = await fetch(`/api/members?id=${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression');
    }

    const remaining = members.filter((m) => m.id !== id);
    setMembers(remaining);
    if (currentMember?.id === id) {
      if (remaining.length > 0) {
        setCurrentMember(remaining[0]);
      } else {
        setCurrentMemberState(null);
        if (currentColoc?.id) {
          localStorage.removeItem(`coloc_active_profile_id_${currentColoc.id}`);
        }
      }
    }
  };

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('coloc_gemini_api_key', key);
  };

  return (
    <ProfileContext.Provider
      value={{
        currentColoc,
        currentMember,
        members,
        setCurrentMember,
        setCurrentColoc,
        createColoc,
        joinColocByCode,
        leaveOrSwitchColoc,
        createMember,
        updateMember,
        deleteMember,
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
