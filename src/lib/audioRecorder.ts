

/**
 * Utilitaire d'enregistrement audio universel (MediaRecorder)
 * Compatible tous navigateurs, en particulier Firefox sur Samsung / Android où SpeechRecognition est absent.
 */

export interface ActiveRecordingSession {
  stop: () => Promise<{ blob: Blob; mimeType: string }>;
  cancel: () => void;
  mimeType: string;
}

/**
 * Détecte le meilleur type MIME audio supporté par le navigateur
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
  ];

  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}

/**
 * Démarre un enregistrement audio via le micro
 */
export async function startAudioRecording(): Promise<ActiveRecordingSession> {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("L'enregistrement audio n'est pas supporté par ce navigateur.");
  }

  // Demande l'accès au micro
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      const error: any = new Error(
        "Microphone bloqué dans Firefox. Veuillez autoriser le micro (cliquez sur le cadenas ou le bouclier dans la barre d'adresse > Autorisations > Microphone > Autoriser)."
      );
      error.isPermissionDenied = true;
      throw error;
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      throw new Error("Aucun microphone détecté sur cet appareil.");
    } else {
      throw new Error(err.message || "Impossible d'accéder au microphone.");
    }
  }

  const mimeType = getSupportedAudioMimeType();
  const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
  const mediaRecorder = new MediaRecorder(stream, options);
  const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

  const chunks: Blob[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Démarrer l'enregistrement avec découpage toutes les 250ms
  mediaRecorder.start(250);

  const stop = (): Promise<{ blob: Blob; mimeType: string }> => {
    return new Promise((resolve) => {
      if (mediaRecorder.state === 'inactive') {
        stream.getTracks().forEach((track) => track.stop());
        resolve({
          blob: new Blob(chunks, { type: actualMimeType }),
          mimeType: actualMimeType,
        });
        return;
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve({
          blob: new Blob(chunks, { type: actualMimeType }),
          mimeType: actualMimeType,
        });
      };

      try {
        mediaRecorder.stop();
      } catch (e) {
        stream.getTracks().forEach((track) => track.stop());
        resolve({
          blob: new Blob(chunks, { type: actualMimeType }),
          mimeType: actualMimeType,
        });
      }
    });
  };

  const cancel = () => {
    try {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    } catch (e) {}
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop,
    cancel,
    mimeType: actualMimeType,
  };
}

/**
 * Convertit un Blob en chaîne Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Envoie un Blob audio à l'API serveur pour transcription fidèle par Gemini Flash
 */
export async function transcribeAudioBlob(
  blob: Blob,
  mimeType: string,
  apiKey?: string
): Promise<string> {
  if (blob.size < 100) {
    return '';
  }

  const effectiveApiKey =
    apiKey ||
    (typeof window !== 'undefined' ? localStorage.getItem('coloc_gemini_api_key') : '') ||
    undefined;

  const base64 = await blobToBase64(blob);
  const response = await fetch('/api/transcribe-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: base64,
      mimeType,
      apiKey: effectiveApiKey,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur de transcription audio');
  }

  const data = await response.json();
  return (data.text || '').trim();
}

/**
 * Nettoie et déduplique les répétitions de phrases ou de mots consécutifs.
 * Corrige le bogue notoire d'Android Chrome (Web Speech API) qui ré-émet le texte précédent
 * ou duplique les phrases dictées dans les événements intermédiaires et finaux.
 */
export function cleanRepeatedPhrases(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  // 1. Répétition globale stricte (ex: 'Phrase A. Phrase A.' ou 'Phrase A Phrase A')
  for (let parts = 2; parts <= 10; parts++) {
    if (cleaned.length % parts === 0) {
      const partLen = cleaned.length / parts;
      const firstPart = cleaned.slice(0, partLen).trim();
      let allMatch = true;
      for (let p = 1; p < parts; p++) {
        const seg = cleaned.slice(p * partLen, (p + 1) * partLen).trim();
        if (seg.toLowerCase() !== firstPart.toLowerCase()) {
          allMatch = false;
          break;
        }
      }
      if (allMatch && firstPart.length > 2) {
        cleaned = firstPart;
        break;
      }
    }
  }

  // 2. Détection et suppression des répétitions de sous-séquences consécutives (1 à 20 mots)
  let words = cleaned.split(' ');
  if (words.length <= 1) return cleaned;

  let changed = true;
  let passes = 0;
  while (changed && passes < 5) {
    changed = false;
    passes++;
    const resultWords: string[] = [];
    let i = 0;
    while (i < words.length) {
      let matchedLen = 0;
      const maxLen = Math.min(20, Math.floor((words.length - i) / 2));
      for (let len = maxLen; len >= 1; len--) {
        let isRepeat = true;
        for (let k = 0; k < len; k++) {
          const w1 = words[i + k].toLowerCase().replace(/[^a-z0-9à-ÿ]/gi, '');
          const w2 = words[i + len + k].toLowerCase().replace(/[^a-z0-9à-ÿ]/gi, '');
          if (w1 !== w2) {
            isRepeat = false;
            break;
          }
        }
        if (isRepeat) {
          matchedLen = len;
          break;
        }
      }

      if (matchedLen > 0) {
        changed = true;
        i += matchedLen;
      } else {
        resultWords.push(words[i]);
        i++;
      }
    }
    words = resultWords;
  }

  return words.join(' ').trim();
}


