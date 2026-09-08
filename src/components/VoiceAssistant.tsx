'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Send, Volume2, CheckCircle, AlertCircle } from 'lucide-react';
import { ExpenseItem } from '@/types';
import { VoiceMatchResult } from '@/lib/voiceMatcher';

interface Props {
  items: ExpenseItem[];
  onItemsAllocated: (matchedIds: string[], action: 'set_personal' | 'set_coloc', explanation: string) => void;
}

export default function VoiceAssistant({ items, onItemsAllocated }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
    }
  }, []);

  // Déclencher l'écoute avec demande explicite de permission micro
  const startListening = async () => {
    setErrorMessage(null);
    setFeedback(null);
    setTranscript('');

    // Demander la permission audio nativement au navigateur
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Arrêter immédiatement les pistes du stream de test pour libérer le micro
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err: any) {
      console.warn('Erreur permission getUserMedia:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone bloqué : veuillez autoriser le micro dans la barre d\'adresse de votre navigateur (icône cadenas ou caméra).'
        );
        return;
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Aucun microphone détecté sur cet appareil.');
        return;
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      setErrorMessage(
        'La reconnaissance vocale directe n\'est pas supportée par ce navigateur. Utilisez la saisie texte ci-dessous ou ouvrez sur Chrome / Safari mobile.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        const current = event.results[0][0].transcript;
        setTranscript(current);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);

        if (event.error === 'not-allowed') {
          setErrorMessage(
            'Accès au micro refusé. Cliquez sur le cadenas à gauche de l\'URL pour autoriser le microphone.'
          );
        } else if (event.error === 'no-speech') {
          setErrorMessage('Aucune parole détectée. Parlez bien distinctement face au micro.');
        } else if (event.error === 'network') {
          setErrorMessage(
            'Erreur réseau du service de dictée vocale. Utilisez le champ texte ci-dessous.'
          );
        } else {
          setErrorMessage(`Erreur micro (${event.error}). Vous pouvez utiliser la saisie texte ci-dessous.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Erreur démarrage recognition:', err);
      setIsListening(false);
      setErrorMessage('Impossible de démarrer le micro. Utilisez la saisie texte ci-dessous.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsListening(false);
  };

  // Traiter la commande
  const processCommand = async (phrase: string) => {
    if (!phrase.trim()) return;

    try {
      const res = await fetch('/api/voice-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: phrase,
          items,
        }),
      });

      if (res.ok) {
        const result: VoiceMatchResult = await res.json();
        onItemsAllocated(result.matchedItemIds, result.action, result.explanation);
        setFeedback(result.explanation);
        setErrorMessage(null);
        setTextInput('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Traitement dès que la dictée se termine avec du texte
  useEffect(() => {
    if (!isListening && transcript.trim().length > 0) {
      processCommand(transcript);
    }
  }, [isListening, transcript]);

  return (
    <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-emerald-50/60 p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
              🎙️ Mode Vocal "Coloc Flemmard"
              <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Gain de temps
              </span>
            </h4>
            <p className="text-[11px] text-emerald-800/80">
              Dictez vos achats à l'oral en 5 secondes, l'IA coche les articles pour vous !
            </p>
          </div>
        </div>

        {/* Bouton Micro */}
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`relative flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-md active:scale-95 ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-300'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              <span>Arrêter l'écoute</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              <span>Appuyer pour parler 🎙️</span>
            </>
          )}
        </button>
      </div>

      {/* Message d'erreur diagnostic si le micro échoue */}
      {errorMessage && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Transcription en direct ou exemple */}
      {isListening ? (
        <div className="rounded-xl bg-white/95 p-3 text-xs text-gray-800 border border-emerald-300 animate-pulse flex items-center gap-2 shadow-inner">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
          <span>Écoute en cours... <em>"{transcript || 'Dites par exemple : Garde pour moi le gel douche et les chocolats...'}"</em></span>
        </div>
      ) : feedback ? (
        <div className="rounded-xl bg-emerald-100/90 p-3 text-xs font-semibold text-emerald-900 border border-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-900/70">
          <span className="font-semibold">Exemples :</span>
          <button
            type="button"
            onClick={() => processCommand('Garde pour moi le gel douche et les kinder bueno')}
            className="rounded-lg bg-white/80 px-2 py-1 hover:bg-white text-emerald-800 border border-emerald-200/60 transition-colors"
          >
            « Garde pour moi le gel douche et les kinder bueno »
          </button>
          <button
            type="button"
            onClick={() => processCommand('Mets le paquet de cookies en perso')}
            className="rounded-lg bg-white/80 px-2 py-1 hover:bg-white text-emerald-800 border border-emerald-200/60 transition-colors"
          >
            « Mets le paquet de cookies en perso »
          </button>
        </div>
      )}

      {/* Alternative écrite rapide */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          processCommand(textInput);
        }}
        className="flex gap-2 pt-1"
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Ou écrivez : 'garde pour moi le chocolat et les chips'..."
          className="flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Appliquer</span>
        </button>
      </form>
    </div>
  );
}
