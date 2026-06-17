import { useRef, useCallback } from 'react';

interface SpeechRecognitionOptions {
  onResult: (text: string) => void;
}

/**
 * Speech recognition hook using Web Speech API (browser built-in).
 * Can be swapped to Azure Speech SDK by replacing this implementation.
 */
export function useSpeechRecognition({ onResult }: SpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stoppedByUserRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const start = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('このブラウザは音声認識をサポートしていません。Chromeを使用してください。');
      return;
    }

    // Avoid double-start; if already running, do nothing.
    if (recognitionRef.current) {
      return;
    }

    stoppedByUserRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const text = lastResult[0].transcript.trim();
        if (text) {
          onResultRef.current(text);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stoppedByUserRef.current = true;
        alert('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      }
    };

    // Auto-restart on end (continuous mode workaround). Guard against
    // rapid loops (no-speech/aborted) by deferring with a short delay and
    // bailing out when the user has stopped or recognition was torn down.
    recognition.onend = () => {
      if (stoppedByUserRef.current || recognitionRef.current !== recognition) {
        return;
      }
      if (restartTimerRef.current !== null) {
        return;
      }
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (stoppedByUserRef.current || recognitionRef.current !== recognition) {
          return;
        }
        try {
          recognition.start();
        } catch (err) {
          // InvalidStateError if it's already started, etc. Swallow.
          console.warn('Speech recognition restart failed:', err);
        }
      }, 300);
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition initial start failed:', err);
      return;
    }
    recognitionRef.current = recognition;
  }, []);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const ref = recognitionRef.current;
    recognitionRef.current = null;
    if (ref) {
      ref.onend = null;
      try {
        ref.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  return { start, stop };
}
