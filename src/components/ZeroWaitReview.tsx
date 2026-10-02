'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { ExpenseItem, ExtractedReceipt } from '@/types';
import { matchVoiceInstruction } from '@/lib/voiceMatcher';
import {
  startAudioRecording,
  transcribeAudioBlob,
  cleanRepeatedPhrases,
  ActiveRecordingSession,
} from '@/lib/audioRecorder';
import {
  Mic,
  MicOff,
  CheckCircle2,
  Sparkles,
  Loader2,
  ArrowLeft,
  Store,
  Calendar,
  Trash2,
  Plus,
  Send,
  Volume2,
  Check,
  AlertCircle,
  Square,
  RotateCcw,
  Key,
  Receipt,
  Edit2,
  Users,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  imageFile: File | null;
  initialData?: ExtractedReceipt | null;
  onCancel: () => void;
  onSaved: () => void;
}

export default function ZeroWaitReview({
  imageFile,
  initialData,
  onCancel,
  onSaved,
}: Props) {
  const { currentColoc, currentMember, members, apiKey, setApiKey } = useProfile();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(!initialData && Boolean(imageFile));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inlineKey, setInlineKey] = useState<string>('');

  const [store, setStore] = useState<string>(initialData?.store || 'Supermarché');
  const [date, setDate] = useState<string>(
    initialData?.date || new Date().toISOString().split('T')[0]
  );
  const [items, setItems] = useState<ExpenseItem[]>(
    (initialData?.items || []).map((it, idx) => ({
      id: `item-${idx}-${Date.now()}`,
      name: it.name,
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || it.totalPrice || 0,
      totalPrice: it.totalPrice || 0,
      isPersonal: it.isPersonal ?? false,
      category: it.category || 'Alimentation',
      assignedMemberIds: it.assignedMemberIds,
    }))
  );

  const [payerId, setPayerId] = useState<string>(
    currentMember?.id || members[0]?.id || ''
  );

  // Synchroniser automatiquement le payeur dès que les profils de la coloc sont chargés
  useEffect(() => {
    if (members.length > 0) {
      const isValidPayer = members.some((m) => m.id === payerId);
      if (!isValidPayer) {
        setPayerId(currentMember?.id || members[0].id);
      }
    }
  }, [members, currentMember?.id, payerId]);

  // Mode édition rapide d'un article
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('1');

  // Gestion vocale en temps masqué
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [saving, setSaving] = useState(false);

  const recognitionRef = useRef<any>(null);
  const recordingSessionRef = useRef<ActiveRecordingSession | null>(null);
  const transcriptRef = useRef<string>('');
  const accumulatedFinalRef = useRef<string>('');
  const pendingPhrasesRef = useRef<string[]>([]);
  const itemsRef = useRef<ExpenseItem[]>(items);
  const analyzedFileRef = useRef<File | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const apiKeyRef = useRef<string | undefined>(apiKey);

  // Synchroniser apiKeyRef
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  // Garder itemsRef toujours synchronisé
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Traiter la phrase vocale ou tapée
  const handleApplyVoice = (phrase: string) => {
    const cleanPhrase = cleanRepeatedPhrases(phrase.trim());
    if (!cleanPhrase) return;

    setTextInput('');

    // Si les articles sont déjà là, appliquer immédiatement
    if (itemsRef.current.length > 0) {
      const match = matchVoiceInstruction(cleanPhrase, itemsRef.current);
      if (match.matchedItemIds.length > 0) {
        setItems((prev) =>
          prev.map((it) =>
            match.matchedItemIds.includes(it.id)
              ? { ...it, isPersonal: match.action === 'set_personal', assignedMemberIds: undefined }
              : it
          )
        );
      }
      setVoiceFeedback(match.explanation);
    } else {
      // Les articles sont en cours d'analyse IA : mémoriser dans la ref
      pendingPhrasesRef.current.push(cleanPhrase);
      setVoiceFeedback(`En mémoire : "${cleanPhrase}" (sera appliqué dès l'extraction)`);
    }
  };

  // Aperçu du ticket : création et libération propre de l'URL pour éviter toute boucle ou fuite mémoire
  useEffect(() => {
    if (!imageFile || imageFile.type === 'application/pdf') {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  // 1. ANALYSER LE TICKET (réutilisable via bouton Réessayer)
  const analyzeReceipt = useCallback(
    async (customKey?: string) => {
      if (!imageFile) return;

      // Annuler toute analyse en cours pour éviter les réponses concurrentes qui écrasent les sélections
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsAnalyzing(true);
      setErrorMsg(null);

      try {
        let base64 = '';
        const mimeType = imageFile.type || 'image/jpeg';
        const isPdf = imageFile.type === 'application/pdf';

        if (isPdf) {
          // Lecture directe pour les fichiers PDF
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) || '');
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });
        } else {
          // Redimensionnement Canvas (1600px, 0.85) -> net et précis
          base64 = await new Promise<string>((resolve, reject) => {
            const tempUrl = URL.createObjectURL(imageFile);
            const img = new Image();
            img.onload = () => {
              try {
                const MAX = 1600;
                let w = img.width;
                let h = img.height;
                if (w > MAX || h > MAX) {
                  if (w > h) {
                    h = Math.round((h * MAX) / w);
                    w = MAX;
                  } else {
                    w = Math.round((w * MAX) / h);
                    h = MAX;
                  }
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error("Impossible de créer le contexte canvas."));
                  return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
              } catch (err) {
                reject(err);
              } finally {
                URL.revokeObjectURL(tempUrl);
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(tempUrl);
              reject(new Error("Format d'image non supporté par le navigateur."));
            };
            img.src = tempUrl;
          });
        }

        const effectiveApiKey =
          customKey ||
          apiKeyRef.current ||
          (typeof window !== 'undefined' ? localStorage.getItem('coloc_gemini_api_key') : '') ||
          undefined;

        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64,
            mimeType: mimeType || 'image/jpeg',
            apiKey: effectiveApiKey,
          }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || "Erreur de lecture du ticket");
        }

        const extracted: ExtractedReceipt = data;
        setStore(extracted.store || 'Supermarché');
        if (extracted.date) setDate(extracted.date);

        const timestamp = Date.now();
        let newItems: ExpenseItem[] = (extracted.items || []).map((it, idx) => {
          const qty = Number(it.quantity) || 1;
          const totPrice =
            typeof it.totalPrice === 'number' && it.totalPrice > 0
              ? Math.round(it.totalPrice * 100) / 100
              : typeof it.unitPrice === 'number' && it.unitPrice > 0
              ? Math.round(it.unitPrice * qty * 100) / 100
              : 0;
          const uPrice =
            typeof it.unitPrice === 'number' && it.unitPrice > 0
              ? Math.round(it.unitPrice * 100) / 100
              : qty > 0 && totPrice > 0
              ? Math.round((totPrice / qty) * 100) / 100
              : totPrice;

          return {
            id: `item-${idx}-${timestamp}`,
            name: it.name || 'Article',
            quantity: qty,
            unitPrice: uPrice,
            totalPrice: totPrice,
            isPersonal: false,
            category: it.category || 'Alimentation',
            assignedMemberIds: it.assignedMemberIds,
          };
        });

        // Si l'utilisateur a déjà dicté ses achats perso pendant le chargement, les appliquer direct !
        if (pendingPhrasesRef.current.length > 0) {
          let lastFeedback = '';
          for (const phrase of pendingPhrasesRef.current) {
            const match = matchVoiceInstruction(phrase, newItems);
            if (match.matchedItemIds.length > 0) {
              newItems = newItems.map((it) =>
                match.matchedItemIds.includes(it.id)
                  ? { ...it, isPersonal: match.action === 'set_personal', assignedMemberIds: undefined }
                  : it
              );
            }
            lastFeedback = match.explanation;
          }
          if (lastFeedback) {
            setVoiceFeedback(lastFeedback);
          }
          pendingPhrasesRef.current = [];
        }

        itemsRef.current = newItems;
        setItems(newItems);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Requête annulée intentionnellement, ne pas afficher d'erreur
          return;
        }
        console.error(err);
        setErrorMsg(err.message || 'Impossible de lire le ticket');
      } finally {
        if (!controller.signal.aborted) {
          setIsAnalyzing(false);
        }
      }
    },
    [imageFile]
  );

  // Déclencher l'analyse une seule fois par image dès le montage (évite la boucle infinie)
  useEffect(() => {
    if (!imageFile || initialData) return;
    if (analyzedFileRef.current === imageFile) return;

    analyzedFileRef.current = imageFile;
    analyzeReceipt();
  }, [imageFile, initialData, analyzeReceipt]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Sécurité réactive : appliquer toute consigne restante dès que items est non vide
  useEffect(() => {
    if (items.length > 0 && pendingPhrasesRef.current.length > 0) {
      let updated = [...items];
      let lastFeedback = '';
      for (const phrase of pendingPhrasesRef.current) {
        const match = matchVoiceInstruction(phrase, updated);
        if (match.matchedItemIds.length > 0) {
          updated = updated.map((it) =>
            match.matchedItemIds.includes(it.id)
              ? { ...it, isPersonal: match.action === 'set_personal', assignedMemberIds: undefined }
              : it
          );
        }
        lastFeedback = match.explanation;
      }
      pendingPhrasesRef.current = [];
      setItems(updated);
      if (lastFeedback) {
        setVoiceFeedback(lastFeedback);
      }
    }
  }, [items]);

  // Configuration Web Speech API avec mode continu et timer de silence généreux (2.5s)
  const silenceTimerRef = useRef<any>(null);

  const stopMediaRecording = async () => {
    if (!recordingSessionRef.current) return;
    const session = recordingSessionRef.current;
    recordingSessionRef.current = null;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setIsListening(false);
    setIsTranscribing(true);

    try {
      const { blob, mimeType } = await session.stop();
      const text = await transcribeAudioBlob(blob, mimeType);
      setIsTranscribing(false);
      if (text) {
        handleApplyVoice(text);
      } else {
        setVoiceFeedback('Aucun mot distinct détecté. Vous pouvez aussi taper votre consigne ci-dessous !');
      }
    } catch (err: any) {
      console.error('Erreur transcription audio:', err);
      setIsTranscribing(false);
      setAudioError(err.message || "Erreur lors de la transcription de l'enregistrement.");
    }
  };

  const resetSilenceTimer = (delay = 2500) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(async () => {
      if (recordingSessionRef.current) {
        await stopMediaRecording();
      } else if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }, delay);
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      // Sur mobile (notamment Android Chrome), continuous = true déclenche le bogue connu
      // où Chromium duplique chaque mot ou phrase 10 fois dans e.results.
      // On désactive continuous sur mobile et on utilise le traitement propre avec e.resultIndex !
      rec.continuous = !isMobile;
      rec.interimResults = true;
      rec.lang = 'fr-FR';

      rec.onstart = () => {
        setIsListening(true);
        setAudioError(null);
        transcriptRef.current = '';
        accumulatedFinalRef.current = '';
        setTranscript('');
        // Laisse jusqu'à 7s au départ pour commencer à parler
        resetSilenceTimer(7000);
      };

      rec.onresult = (e: any) => {
        let finalChunk = '';
        let interimChunk = '';

        // Utiliser e.resultIndex au lieu de 0 pour ne JAMAIS concaténer les événements passés en boucle
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const item = e.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            finalChunk += ' ' + text;
          } else {
            interimChunk += ' ' + text;
          }
        }

        if (finalChunk.trim()) {
          accumulatedFinalRef.current = (
            accumulatedFinalRef.current +
            ' ' +
            finalChunk
          ).trim();
        }

        const rawCombined = (accumulatedFinalRef.current + ' ' + interimChunk).trim();
        const cleaned = cleanRepeatedPhrases(rawCombined);

        transcriptRef.current = cleaned;
        setTranscript(cleaned);

        // Dès qu'on entend des mots, on attend 2.5 secondes de silence complet avant de valider
        resetSilenceTimer(2500);
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('SpeechRecognition error:', e);
          setIsListening(false);
        }
      };

      rec.onend = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        setIsListening(false);
        const finalPhrase = cleanRepeatedPhrases(
          (accumulatedFinalRef.current || transcriptRef.current).trim()
        );
        if (finalPhrase) {
          handleApplyVoice(finalPhrase);
          transcriptRef.current = '';
          accumulatedFinalRef.current = '';
          setTranscript('');
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recordingSessionRef.current) {
        recordingSessionRef.current.cancel();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  // Déclencher / Arrêter écoute micro (Web Speech API ou MediaRecorder universel pour Firefox)
  const toggleListening = async () => {
    setAudioError(null);

    if (isListening) {
      if (recordingSessionRef.current) {
        await stopMediaRecording();
      } else if (recognitionRef.current) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    } else {
      transcriptRef.current = '';
      setTranscript('');

      const SpeechRecognition =
        typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

      // Si le navigateur supporte Web Speech API (Chrome, Safari, etc.)
      if (SpeechRecognition && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch (e) {
          console.warn('SpeechRecognition inaccessible, passage au fallback MediaRecorder:', e);
        }
      }

      // Fallback universel MediaRecorder + Gemini (Firefox sur Samsung / Android, etc.)
      try {
        const session = await startAudioRecording();
        recordingSessionRef.current = session;
        setIsListening(true);
        // Arrêt automatique de sécurité après 12 secondes
        resetSilenceTimer(12000);
      } catch (err: any) {
        console.warn('Erreur accès micro:', err);
        setIsListening(false);
        if (err.isPermissionDenied) {
          setAudioError(
            "Microphone bloqué dans Firefox. Veuillez autoriser le micro (cliquez sur le cadenas ou bouclier dans la barre d'adresse > Autorisations > Microphone > Autoriser)."
          );
        } else {
          setAudioError(err.message || "Impossible d'accéder au microphone.");
        }
      }
    }
  };

  // État de sélection personnalisée des colocataires
  const [memberPickerItem, setMemberPickerItem] = useState<ExpenseItem | null>(null);
  const [tempSelectedMemberIds, setTempSelectedMemberIds] = useState<string[]>([]);
  const [isBatchPicker, setIsBatchPicker] = useState<boolean>(false);

  const openMemberPicker = (item: ExpenseItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    if (tempSelectedMemberIds.length === 0) {
      alert('Veuillez sélectionner au moins un colocataire.');
      return;
    }

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

  // Basculer un article manuellement
  const toggleItem = (item: ExpenseItem) => {
    const validAssigned = item.assignedMemberIds?.filter((id) => members.some((m) => m.id === id));
    const isCustom = !item.isPersonal && Boolean(validAssigned && validAssigned.length > 0 && validAssigned.length < members.length);
    if (isCustom) {
      // Si l'article a déjà une attribution personnalisée, ouvrir le sélecteur
      openMemberPicker(item);
      return;
    }

    const newIsPersonal = !item.isPersonal;
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              isPersonal: newIsPersonal,
              assignedMemberIds: undefined,
            }
          : it
      )
    );
  };

  // Définir explicitement le statut d'un article
  const setItemPersonal = (id: string, isPersonal: boolean) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              isPersonal,
              assignedMemberIds: undefined,
            }
          : it
      )
    );
  };

  // Passer tous les articles en Coloc ou en Perso
  const setAllPersonal = (isPersonal: boolean) => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        isPersonal,
        assignedMemberIds: undefined,
      }))
    );
  };

  // Supprimer un article
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingItemId === id) {
      setEditingItemId(null);
    }
  };

  // Éditer un article
  const startEditItem = (item: ExpenseItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.totalPrice.toFixed(2));
    setEditQty(String(item.quantity || 1));
  };

  const saveEditedItem = (id: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    const parsedPrice = parseFloat(editPrice.replace(',', '.')) || 0;
    const parsedQty = parseInt(editQty, 10) || 1;
    const cleanPrice = Math.max(0, Math.round(parsedPrice * 100) / 100);
    const cleanQty = Math.max(1, parsedQty);

    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              name: editName.trim() || it.name,
              quantity: cleanQty,
              totalPrice: cleanPrice,
              unitPrice: Math.round((cleanPrice / cleanQty) * 100) / 100,
            }
          : it
      )
    );
    setEditingItemId(null);
  };

  const cancelEditItem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItemId(null);
  };

  // Ajouter un article manquant et ouvrir son édition
  const addItem = () => {
    const newId = `item-manual-${Date.now()}`;
    const newItem: ExpenseItem = {
      id: newId,
      name: 'Nouvel article',
      quantity: 1,
      unitPrice: 1.0,
      totalPrice: 1.0,
      isPersonal: false,
      category: 'Alimentation',
    };
    setItems((prev) => [...prev, newItem]);
    setEditingItemId(newId);
    setEditName('Nouvel article');
    setEditPrice('1.00');
    setEditQty('1');
  };

  // Calculs en temps réel
  const colocTotal = Math.round(
    items.filter((it) => !it.isPersonal).reduce((acc, it) => acc + it.totalPrice, 0) * 100
  ) / 100;

  const persoTotal = Math.round(
    items.filter((it) => it.isPersonal).reduce((acc, it) => acc + it.totalPrice, 0) * 100
  ) / 100;

  const grandTotal = Math.round((colocTotal + persoTotal) * 100) / 100;

  // Sauvegarder
  const handleSave = async () => {
    if (!payerId) {
      alert('Sélectionnez qui a payé');
      return;
    }
    if (items.length === 0) {
      alert('Il faut au moins un article dans la dépense');
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
          colocationId: currentColoc?.id || null,
          fileType: 'receipt_photo',
        }),
      });

      if (res.ok) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        onSaved();
      } else {
        alert("Erreur lors de l'enregistrement");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-24 animate-fadeIn">
      {/* Barre supérieure simple */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Annuler
        </button>

        {/* Badge d'état IA temps réel */}
        {isAnalyzing ? (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
            <span>Lecture du ticket en cours...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span>{store} ({items.length} articles)</span>
          </div>
        )}
      </div>

      {/* ZONE TEMPS MASQUÉ : LE VOCAL PENDANT LE CHARGEMENT */}
      <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/70 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-gray-900">
                {isAnalyzing
                  ? 'Gagnez du temps : que gardez-vous pour vous ?'
                  : 'Mode vocal "Coloc Flemmard"'}
              </h4>
              <p className="text-[11px] text-gray-500">
                Dictez vos achats perso pendant que l'IA déchiffre le ticket !
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all shadow-md active:scale-95 ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isListening ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Terminer</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                <span>Parler</span>
              </>
            )}
          </button>
        </div>

        {/* Retranscription, chargement IA ou retour */}
        {isListening ? (
          <div className="rounded-xl bg-white p-3 text-xs text-gray-800 border-2 border-emerald-400 shadow-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="font-bold text-gray-900 truncate">
                {transcript ? `🎙️ « ${transcript} »` : '🎙️ Enregistrement en cours... Parlez puis touchez Terminer.'}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleListening}
              className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 active:scale-95"
            >
              Terminer
            </button>
          </div>
        ) : isTranscribing ? (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border-2 border-amber-300 shadow-sm flex items-center gap-2 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
            <span className="font-bold">Transcription de votre voix par l'IA en cours...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Bannière de diagnostic explicite pour Firefox / Samsung */}
            {audioError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-300 shadow-sm space-y-2 break-words min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="font-semibold break-words">{audioError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudioError(null)}
                    className="text-rose-500 hover:text-rose-800 font-bold px-1 shrink-0"
                    title="Fermer"
                  >
                    ✕
                  </button>
                </div>
                <div className="rounded-lg bg-white/90 p-2 text-[11px] text-gray-800 border border-rose-200">
                  <span className="font-bold text-rose-900">💡 Astuce Samsung / Android :</span> Vous pouvez aussi simplement toucher le champ texte ci-dessous et appuyer sur le micro 🎙️ de votre clavier Samsung ou Gboard pour dicter directement !
                </div>
              </div>
            )}

            {voiceFeedback && (
              <div className="rounded-xl bg-emerald-100 p-2.5 text-xs font-bold text-emerald-900 border border-emerald-300 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>{voiceFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceFeedback(null)}
                  className="text-emerald-600 hover:text-emerald-900 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyVoice(textInput);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ex: 'Le gel douche et les chips en perso'..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                Appliquer
              </button>
            </form>
            <p className="text-[10px] text-gray-500 italic">
              💡 Astuce : Sur mobile, vous pouvez aussi dicter directement avec le micro de votre clavier.
            </p>
          </div>
        )}
      </div>

      {/* QUI A PAYÉ ? */}
      <div className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 p-3 text-xs">
        <span className="font-bold text-gray-600">Qui a avancé les frais ?</span>
        <select
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-900 focus:outline-none"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.avatar} {m.name} {m.id === currentMember?.id ? '(Moi)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* MAGASIN & DATE MODIFIABLES */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 px-3 py-2 shadow-sm">
          <Store className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-gray-400 block uppercase">Magasin</span>
            <input
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="Ex: Carrefour, Lidl..."
              className="w-full bg-transparent font-bold text-gray-800 focus:outline-none text-xs truncate"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 px-3 py-2 shadow-sm">
          <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-gray-400 block uppercase">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent font-bold text-gray-800 focus:outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {/* ERREUR EVENTUELLE */}
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 space-y-2.5 break-words min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="break-words">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-800 font-bold px-1 shrink-0"
              title="Fermer"
            >
              ✕
            </button>
          </div>

          {/* Saisie rapide de la clé API si manquante ou expirée */}
          {(errorMsg.includes('Clé API') || errorMsg.includes('crédits') || errorMsg.includes('NO_API_KEY')) && (
            <div className="pt-1 space-y-1.5 bg-white/70 p-2.5 rounded-lg border border-rose-200">
              <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-rose-600" />
                Collez votre clé Google Gemini ici :
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  placeholder="AQ.Ab8RN..."
                  value={inlineKey}
                  onChange={(e) => setInlineKey(e.target.value)}
                  className="flex-1 bg-white border border-rose-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = inlineKey.trim();
                    if (trimmed) {
                      setApiKey(trimmed);
                      analyzeReceipt(trimmed);
                    }
                  }}
                  disabled={!inlineKey.trim() || isAnalyzing}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
                >
                  <Check className="h-3.5 w-3.5" />
                  Valider
                </button>
              </div>
            </div>
          )}

          {/* Bouton Réessayer */}
          <div className="pt-0.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => analyzeReceipt()}
              disabled={isAnalyzing}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réessayer le scan
            </button>
          </div>
        </div>
      )}

      {/* APERÇU DU TICKET DE CAISSE (ESCORTÉ / CONSULTABLE) */}
      {previewUrl && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setShowImagePreview((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-bold text-gray-700 hover:text-emerald-700 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Photo du ticket de caisse
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {showImagePreview ? 'Masquer' : 'Voir la photo'}
            </span>
          </button>
          {showImagePreview && (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-900 max-h-72 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Ticket original"
                className="max-h-72 object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* LISTE DES ARTICLES TACTILES */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider block">
              Articles ({items.length})
            </span>
            <span className="text-[11px] text-gray-400">
              Touchez un article ou les boutons pour basculer Coloc / Perso
            </span>
          </div>

          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAllPersonal(false)}
                className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                title="Passer tous les articles en Coloc"
              >
                Tout Coloc
              </button>
              <button
                type="button"
                onClick={() => setAllPersonal(true)}
                className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                title="Passer tous les articles en Perso"
              >
                Tout Perso
              </button>
              <button
                type="button"
                onClick={openBatchMemberPicker}
                className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                title="Attribuer tous les articles à des colocataires précis"
              >
                <Users className="h-3 w-3" />
                <span>Certains</span>
              </button>
              <button
                type="button"
                onClick={addItem}
                className="text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                title="Ajouter un article manquant"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {items.length === 0 && isAnalyzing ? (
          <div className="py-12 text-center rounded-2xl bg-white border border-gray-100 shadow-sm space-y-2">
            <Loader2 className="h-7 w-7 mx-auto animate-spin text-emerald-600" />
            <p className="text-xs font-bold text-gray-700">Déchiffrement du ticket...</p>
            <p className="text-[11px] text-gray-400">Vos articles vont s'afficher ici dans un instant</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center rounded-2xl bg-white border border-gray-100 shadow-sm space-y-2">
            <p className="text-xs font-bold text-gray-700">Aucun article détecté</p>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 hover:bg-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un article manuellement
            </button>
          </div>
        ) : (
          items.map((item) =>
            editingItemId === item.id ? (
              <div
                key={item.id}
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl border-2 border-emerald-400 bg-white p-3.5 shadow-md space-y-2.5 animate-fadeIn"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">
                      Nom de l'article
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nom de l'article"
                      className="w-full rounded-xl border border-gray-300 px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:border-emerald-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="w-full sm:w-24">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5 sm:text-right">
                      Prix total
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-gray-300 pl-2 pr-6 py-1.5 text-xs font-black text-gray-900 focus:border-emerald-500 focus:outline-none sm:text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                        €
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className="text-[11px] text-gray-400 font-bold uppercase">Quantité :</span>
                    <input
                      type="number"
                      min="1"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-12 rounded-lg border border-gray-300 px-2 py-1 text-xs font-bold text-center"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelEditItem}
                      className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={(e) => saveEditedItem(item.id, e)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" /> Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            ) : (() => {
              const validAssigned = item.assignedMemberIds?.filter((id) => members.some((m) => m.id === id));
              const isCustom = !item.isPersonal && Boolean(validAssigned && validAssigned.length > 0 && validAssigned.length < members.length);
              const isAll = !item.isPersonal && !isCustom;
              const isPerso = Boolean(item.isPersonal);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleItem(item);
                    }
                  }}
                  className={`flex flex-col gap-2 rounded-2xl border p-3 cursor-pointer select-none transition-all active:scale-[0.99] ${
                    isPerso
                      ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                      : isCustom
                      ? 'border-purple-300 bg-purple-50/70 shadow-sm'
                      : 'border-emerald-200 bg-white hover:bg-emerald-50/30 shadow-sm'
                  }`}
                >
                  {/* Ligne 1 : Nom complet du produit & Prix */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-gray-900 break-words leading-snug">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        {item.quantity > 1 && (
                          <span className="font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.2 rounded text-[10px]">
                            x{item.quantity}
                          </span>
                        )}
                        <span>{item.category || 'Alimentation'}</span>
                        {item.quantity > 1 && item.unitPrice > 0 && (
                          <span className="text-gray-400">({item.unitPrice.toFixed(2)} €/u)</span>
                        )}
                      </div>

                      {isCustom && validAssigned && (
                        <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-lg border border-purple-200 mt-1.5 w-fit max-w-full">
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
                      <span className="text-xs sm:text-sm font-black text-gray-900">
                        {item.totalPrice.toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* Ligne 2 : Sélecteur Coloc / Perso / Certains & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100/80">
                    {/* Sélecteur tactile Coloc / Perso / Certains */}
                    <div className="flex-1 min-w-0 flex rounded-xl bg-gray-100/90 p-0.5 border border-gray-200/80 shadow-inner">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemPersonal(item.id, false);
                        }}
                        className={`flex-1 py-1.5 px-2 text-center rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                          isAll
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-gray-500 hover:text-emerald-700'
                        }`}
                        title="Partagé avec toute la coloc"
                      >
                        <span>🟢</span>
                        <span>Coloc</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemPersonal(item.id, true);
                        }}
                        className={`flex-1 py-1.5 px-2 text-center rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                          isPerso
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-500 hover:text-blue-700'
                        }`}
                        title="Achat perso (pour moi seul)"
                      >
                        <span>🔵</span>
                        <span>Perso</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openMemberPicker(item, e)}
                        className={`flex-1 py-1.5 px-2 text-center rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                          isCustom
                            ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-300'
                            : 'text-gray-500 hover:text-purple-700'
                        }`}
                        title="Choisir des colocataires précis"
                      >
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="truncate">{isCustom ? `${item.assignedMemberIds?.length}` : 'Certains'}</span>
                      </button>
                    </div>

                    {/* Modifier cet article */}
                    <button
                      type="button"
                      onClick={(e) => startEditItem(item, e)}
                      className="text-gray-400 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                      title="Modifier le nom ou le prix de cet article"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Supprimer cet article */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="text-gray-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                      title="Supprimer cet article"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()
          )
        )}
      </div>

      {/* BARRE FIXE EN BAS : TOTAUX & VALIDATION */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 border-t border-gray-200 p-3.5 backdrop-blur-md z-30 shadow-2xl">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-gray-500 font-semibold">
              Total : {grandTotal.toFixed(2)} €
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-700">
              Coloc : {colocTotal.toFixed(2)} €
              {persoTotal > 0 && (
                <span className="text-xs text-blue-600 ml-1.5 font-bold">
                  (Perso: {persoTotal.toFixed(2)}€)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? 'Enregistrement...' : 'Valider la dépense 🚀'}
          </button>
        </div>
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
