

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
export async function transcribeAudioBlob(blob: Blob, mimeType: string): Promise<string> {
  if (blob.size < 100) {
    return '';
  }

  const base64 = await blobToBase64(blob);
  const response = await fetch('/api/transcribe-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: base64,
      mimeType,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur de transcription audio');
  }

  const data = await response.json();
  return (data.text || '').trim();
}

