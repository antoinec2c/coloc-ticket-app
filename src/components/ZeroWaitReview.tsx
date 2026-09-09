'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const { currentColoc, currentMember, members } = useProfile();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(!initialData && Boolean(imageFile));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    }))
  );

  const [payerId, setPayerId] = useState<string>(
    currentMember?.id || members[0]?.id || ''
  );

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
              ? { ...it, isPersonal: match.action === 'set_personal' }
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

  // 1. DÉMARRER L'ANALYSE EN ARRIÈRE-PLAN DÈS LE MONTAGE
  useEffect(() => {
    if (!imageFile) return;

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    const processAndAnalyze = async () => {
      setIsAnalyzing(true);
      setErrorMsg(null);

      try {
        // Redimensionnement rapide côté client Canvas (1024px, 0.75) -> fichier ~60Ko
        const base64 = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 1024;
            let w = img.width;
            let h = img.height;
            if (w > MAX || h > MAX) {
              if (w > h) {
                h = Math.round((h * MAX) / w);
                w = MAX;
              } else {
                w = Math.round((w * MAX) / h);
                w = MAX;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };
          img.onerror = reject;
          img.src = objectUrl;
        });

        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64,
            mimeType: 'image/jpeg',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || "Erreur de lecture du ticket");
        }

        const extracted: ExtractedReceipt = data;
        setStore(extracted.store || 'Supermarché');
        if (extracted.date) setDate(extracted.date);

        let newItems: ExpenseItem[] = (extracted.items || []).map((it, idx) => ({
          id: `item-${idx}-${Date.now()}`,
          name: it.name,
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || it.totalPrice || 0,
          totalPrice: it.totalPrice || 0,
          isPersonal: false,
          category: it.category || 'Alimentation',
        }));

        // Si l'utilisateur a déjà dicté ses achats perso pendant le chargement, les appliquer direct !
        if (pendingPhrasesRef.current.length > 0) {
          let lastFeedback = '';
          for (const phrase of pendingPhrasesRef.current) {
            const match = matchVoiceInstruction(phrase, newItems);
            if (match.matchedItemIds.length > 0) {
              newItems = newItems.map((it) =>
                match.matchedItemIds.includes(it.id)
                  ? { ...it, isPersonal: match.action === 'set_personal' }
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
        console.error(err);
        setErrorMsg(err.message || 'Impossible de lire le ticket');
      } finally {
        setIsAnalyzing(false);
      }
    };

    processAndAnalyze();
  }, [imageFile]);

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
              ? { ...it, isPersonal: match.action === 'set_personal' }
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

  // Basculer un article manuellement
  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isPersonal: !it.isPersonal } : it))
    );
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
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-300 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="font-semibold">{audioError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudioError(null)}
                    className="text-rose-500 hover:text-rose-800 font-bold px-1"
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

      {/* ERREUR EVENTUELLE */}
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* LISTE DES ARTICLES TACTILES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
            Articles ({items.length})
          </span>
          <span className="text-[11px] text-gray-400">
            Touchez pour basculer Coloc / Perso
          </span>
        </div>

        {items.length === 0 && isAnalyzing ? (
          <div className="py-12 text-center rounded-2xl bg-white border border-gray-100 shadow-sm space-y-2">
            <Loader2 className="h-7 w-7 mx-auto animate-spin text-emerald-600" />
            <p className="text-xs font-bold text-gray-700">Déchiffrement du ticket...</p>
            <p className="text-[11px] text-gray-400">Vos articles vont s'afficher ici dans un instant</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex items-center justify-between rounded-2xl border p-3.5 cursor-pointer transition-all active:scale-[0.98] ${
                item.isPersonal
                  ? 'border-blue-300 bg-blue-50/60 shadow-sm'
                  : 'border-emerald-200 bg-white hover:bg-emerald-50/30 shadow-sm'
              }`}
            >
              <div className="flex-1 pr-3">
                <div className="text-xs sm:text-sm font-bold text-gray-900">
                  {item.name}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {item.quantity > 1 ? `x${item.quantity} • ` : ''}{item.category}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-gray-900">
                  {item.totalPrice.toFixed(2)} €
                </span>

                <span
                  className={`rounded-xl px-2.5 py-1 text-[11px] font-black tracking-wide ${
                    item.isPersonal
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.isPersonal ? '🔵 Pour moi' : '🟢 Coloc'}
                </span>
              </div>
            </div>
          ))
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
    </div>
  );
}
