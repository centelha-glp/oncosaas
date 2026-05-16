'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';
import { publicExamIngestUpload } from '@/lib/api/exam-ingest';
import { EXAM_INGEST_CLIENT_ACCEPT } from '@/lib/exam-ingest-file-accept';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_EXAM_RECORDING_MS = 5 * 60 * 1000;

const EXAM_ALLOWED_MIME_SET = new Set(
  EXAM_INGEST_CLIENT_ACCEPT.split(',').map((m) => m.trim().toLowerCase())
);

function normalizeMime(type: string): string {
  return (type || '').split(';')[0].trim().toLowerCase();
}

function isAllowedExamFile(file: File): boolean {
  return EXAM_ALLOWED_MIME_SET.has(normalizeMime(file.type));
}

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function audioBlobToFile(blob: Blob, mimeFull: string): File {
  const baseMime = mimeFull.split(';')[0].trim().toLowerCase();
  const ext =
    baseMime === 'audio/ogg' || baseMime.endsWith('/ogg')
      ? 'ogg'
      : baseMime === 'audio/mpeg' || baseMime === 'audio/mp3'
        ? 'mp3'
        : 'webm';
  return new File([blob], `exame-gravado-${Date.now()}.${ext}`, {
    type: baseMime || 'audio/webm',
  });
}

export default function MobileExamIngestPage() {
  const params = useParams();
  const token = params.token as string;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordMimeRef = useRef<string>('audio/webm');
  const recordLockRef = useRef(false);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');

  const stopMediaStream = useCallback(() => {
    const s = recordStreamRef.current;
    recordStreamRef.current = null;
    if (s) {
      for (const t of s.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      const r = await publicExamIngestUpload(token, file);
      setStatus(`Enviado com sucesso (${r.fileCount} ficheiro(s) na sessão).`);
      toast.success('Envio concluído.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro no envio';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const finalizeRecordingUpload = useCallback(
    (blob: Blob, mimeFull: string) => {
      const file = audioBlobToFile(blob, mimeFull);
      if (!isAllowedExamFile(file)) {
        toast.error('Formato de áudio gravado não suportado.');
        return;
      }
      void uploadFile(file);
    },
    [uploadFile]
  );

  const stopRecording = useCallback(() => {
    const rec = recordRecorderRef.current;
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (!rec || rec.state === 'inactive') {
      setIsRecording(false);
      setRecordingStatus('');
      stopMediaStream();
      recordLockRef.current = false;
      return;
    }
    setRecordingStatus('A terminar gravação…');
    rec.stop();
  }, [stopMediaStream]);

  const startRecording = useCallback(async () => {
    if (loading || recordLockRef.current) return;
    const mime = pickRecordingMimeType();
    if (!mime) {
      toast.error('O navegador não suporta gravação de áudio neste formato.');
      return;
    }
    recordLockRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      recordMimeRef.current = mime;
      const opts = MediaRecorder.isTypeSupported(mime)
        ? { mimeType: mime }
        : undefined;
      const rec = new MediaRecorder(stream, opts);
      recordRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      rec.onerror = () => {
        toast.error('Erro durante a gravação.');
        recordLockRef.current = false;
        setIsRecording(false);
        setRecordingStatus('');
        stopMediaStream();
        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };
      rec.onstop = () => {
        const chunks = [...recordChunksRef.current];
        recordChunksRef.current = [];
        recordRecorderRef.current = null;
        stopMediaStream();
        recordLockRef.current = false;
        setIsRecording(false);
        setRecordingStatus('');
        const mimeUsed = recordMimeRef.current;
        const blob = new Blob(chunks, {
          type: mimeUsed.split(';')[0].trim() || 'audio/webm',
        });
        if (blob.size < 64) {
          toast.error('Gravação demasiado curta; tente novamente.');
          return;
        }
        finalizeRecordingUpload(blob, mimeUsed);
      };
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      recordTimerRef.current = window.setTimeout(() => {
        recordTimerRef.current = null;
        stopRecording();
      }, MAX_EXAM_RECORDING_MS);
      rec.start(1000);
      setIsRecording(true);
      setRecordingStatus('A gravar…');
    } catch (e) {
      recordLockRef.current = false;
      const denied =
        e instanceof DOMException &&
        (e.name === 'NotAllowedError' ||
          e.name === 'PermissionDeniedError');
      if (denied) {
        toast.error(
          'Permissão de microfone negada. Ative o microfone nas definições do navegador.'
        );
      } else {
        toast.error('Não foi possível aceder ao microfone.');
      }
      stopMediaStream();
    }
  }, [
    finalizeRecordingUpload,
    loading,
    stopMediaStream,
    stopRecording,
  ]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const rec = recordRecorderRef.current;
      recordRecorderRef.current = null;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.onstop = () => {};
          rec.ondataavailable = null;
          rec.onerror = null;
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      recordLockRef.current = false;
      stopMediaStream();
    };
  }, [stopMediaStream]);

  const onPick = async (file: File | undefined) => {
    setError(null);
    setStatus(null);
    if (!file) return;
    setLoading(true);
    try {
      const r = await publicExamIngestUpload(token, file);
      setStatus(`Enviado com sucesso (${r.fileCount} ficheiro(s) na sessão).`);
      toast.success('Envio concluído.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro no envio';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = () => {
    if (loading) return;
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const controlsDisabled = loading || isRecording;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
      <div className="max-w-md w-full space-y-6 rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-center">Enviar exame</h1>
        <p className="text-sm text-muted-foreground text-center">
          Escolha foto, PDF ou áudio do resultado. Não é necessário iniciar sessão.
        </p>
        <input
          ref={cameraRef}
          type="file"
          className="hidden"
          accept={EXAM_INGEST_CLIENT_ACCEPT}
          capture="environment"
          disabled={controlsDisabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void onPick(f);
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          className="hidden"
          accept={EXAM_INGEST_CLIENT_ACCEPT}
          disabled={controlsDisabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void onPick(f);
          }}
        />
        <div
          className="flex flex-col gap-3"
          aria-live="polite"
          aria-atomic="true"
        >
          <Button
            type="button"
            disabled={controlsDisabled}
            onClick={() => cameraRef.current?.click()}
          >
            Câmara ou ficheiro
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={controlsDisabled}
            onClick={() => galleryRef.current?.click()}
          >
            Galeria
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            aria-pressed={isRecording}
            aria-label={
              isRecording ? 'Parar gravação de áudio' : 'Gravar áudio'
            }
            className={cn(isRecording && 'border-destructive text-destructive')}
            onClick={toggleRecording}
          >
            <Mic className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {isRecording ? 'Parar gravação' : 'Gravar áudio'}
          </Button>
          <p
            className={cn(
              'text-sm text-center text-muted-foreground min-h-[1.25rem]',
              !recordingStatus && 'sr-only'
            )}
          >
            {recordingStatus || ' '}
          </p>
        </div>
        {loading && !isRecording && (
          <p className="text-sm text-center text-muted-foreground">A enviar…</p>
        )}
        {status && (
          <p className="text-sm text-center text-green-700 dark:text-green-400">
            {status}
          </p>
        )}
        {error && (
          <p className="text-sm text-center text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
