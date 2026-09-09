'use client';

import React, { useState, useRef } from 'react';
import { ExtractedReceipt } from '@/types';
import { useProfile } from '@/context/ProfileContext';
import {
  Camera,
  Upload,
  FileText,
  RotateCw,
  Sparkles,
  AlertCircle,
  Loader2,
  Edit3,
} from 'lucide-react';

interface Props {
  onExtracted: (receipt: ExtractedReceipt, previewUrl: string | null) => void;
  onManualMode: () => void;
}

export default function ReceiptUploader({ onExtracted, onManualMode }: Props) {
  const { apiKey } = useProfile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setMimeType(file.type);
    setErrorMsg(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Redimensionnement automatique pour smartphone (ultra rapide et léger)
  const getProcessedBase64 = async (): Promise<string> => {
    if (!previewUrl || mimeType === 'application/pdf') {
      return previewUrl || '';
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 1600;
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
            targetWidth = MAX_DIMENSION;
          } else {
            targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
            targetHeight = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        if (rotation % 180 !== 0) {
          canvas.width = targetHeight;
          canvas.height = targetWidth;
        } else {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = previewUrl;
    });
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const base64ToSend = await getProcessedBase64();

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64ToSend,
          mimeType: mimeType || 'image/jpeg',
          apiKey: apiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Échec de l\'analyse.');
      }

      onExtracted(data, previewUrl);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erreur lors de la lecture du ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      {/* Inputs cachés */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />

      {/* Pas encore de photo */}
      {!previewUrl ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Bouton Appareil photo */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 p-6 text-emerald-900 shadow-sm active:scale-95 transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <Camera className="h-7 w-7" />
              </div>
              <span className="mt-3 text-base font-black">Prendre une photo</span>
              <span className="text-xs text-emerald-700/80 mt-1">Ticket froissé, papier thermique</span>
            </button>

            {/* Bouton Choisir image ou PDF */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/80 p-6 text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200 text-gray-700">
                <Upload className="h-7 w-7" />
              </div>
              <span className="mt-3 text-base font-bold">Galerie photo ou PDF</span>
              <span className="text-xs text-gray-400 mt-1">Facture EDF, courses Drive</span>
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onManualMode}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 underline"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Ou saisir directement le montant à la main
            </button>
          </div>
        </div>
      ) : (
        /* Photo chargée */
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 flex items-center justify-center max-h-80">
            {mimeType === 'application/pdf' ? (
              <div className="py-12 text-center text-white space-y-2">
                <FileText className="h-12 w-12 mx-auto text-emerald-400" />
                <p className="font-bold text-sm">Facture PDF chargée</p>
                <p className="text-xs text-gray-400">{selectedFile?.name}</p>
              </div>
            ) : (
              <img
                src={previewUrl}
                alt="Ticket scanné"
                style={{ transform: `rotate(${rotation}deg)` }}
                className="max-h-80 object-contain transition-transform duration-200"
              />
            )}

            {/* Bouton pivoter */}
            {mimeType !== 'application/pdf' && (
              <button
                type="button"
                onClick={handleRotate}
                className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-xl bg-black/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md hover:bg-black"
              >
                <RotateCw className="h-3.5 w-3.5" /> Pivoter
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                setSelectedFile(null);
                setErrorMsg(null);
              }}
              className="absolute top-3 right-3 rounded-xl bg-black/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md"
            >
              Reprendre
            </button>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Déchiffrement de votre ticket en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Déchiffrer ce ticket avec l'IA ✨</span>
              </>
            )}
          </button>

          {errorMsg && (
            <div className="flex items-start justify-between gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 break-words min-w-0">
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
          )}
        </div>
      )}
    </div>
  );
}
