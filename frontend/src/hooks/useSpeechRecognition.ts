import { useRef, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

interface SpeechRecognitionOptions {
  onResult: (text: string, speaker?: string) => void;
  language?: string;
}

async function fetchSpeechToken(): Promise<{ token: string; region: string }> {
  const res = await fetch('/api/speech-token');
  if (!res.ok) {
    throw new Error(`Speech token request failed: ${res.status}`);
  }
  return res.json();
}

// Azure AAD tokens expire in 10 minutes; refresh every 8 minutes to be safe.
const TOKEN_REFRESH_INTERVAL_MS = 8 * 60 * 1000;

/**
 * Speech recognition hook using Azure Speech SDK ConversationTranscriber.
 * Supports multi-language and speaker diarization.
 * Automatically refreshes the auth token before expiry.
 */
export function useSpeechRecognition({ onResult, language = 'ja-JP' }: SpeechRecognitionOptions) {
  const transcriberRef = useRef<SpeechSDK.ConversationTranscriber | null>(null);
  const speechConfigRef = useRef<SpeechSDK.SpeechConfig | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const languageRef = useRef(language);
  languageRef.current = language;

  const refreshToken = useCallback(async () => {
    try {
      const tokenData = await fetchSpeechToken();
      if (speechConfigRef.current) {
        speechConfigRef.current.authorizationToken = tokenData.token;
        console.log('Speech token refreshed');
      }
    } catch (err) {
      console.error('Failed to refresh speech token:', err);
    }
  }, []);

  const start = useCallback(async () => {
    // Avoid double-start.
    if (transcriberRef.current) {
      return;
    }

    let tokenData: { token: string; region: string };
    try {
      tokenData = await fetchSpeechToken();
    } catch (err) {
      console.error('Failed to get speech token:', err);
      alert('Speech トークンの取得に失敗しました。バックエンドが起動しているか確認してください。');
      return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
      tokenData.token,
      tokenData.region
    );
    speechConfig.speechRecognitionLanguage = languageRef.current;
    speechConfigRef.current = speechConfig;

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const transcriber = new SpeechSDK.ConversationTranscriber(speechConfig, audioConfig);

    transcriber.transcribed = (_sender, event) => {
      if (
        event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech &&
        event.result.text.trim()
      ) {
        const speaker = event.result.speakerId || undefined;
        onResultRef.current(event.result.text.trim(), speaker);
      }
    };

    transcriber.canceled = (_sender, event) => {
      if (event.reason === SpeechSDK.CancellationReason.Error) {
        console.error('Speech recognition error:', event.errorDetails);
        // Attempt auto-recovery: refresh token and restart
        (async () => {
          console.log('Attempting auto-recovery after cancellation...');
          try {
            const newToken = await fetchSpeechToken();
            if (speechConfigRef.current) {
              speechConfigRef.current.authorizationToken = newToken.token;
            }
            transcriber.startTranscribingAsync(
              () => console.log('Transcription recovered after token refresh'),
              (restartErr) => console.error('Recovery failed:', restartErr)
            );
          } catch (refreshErr) {
            console.error('Token refresh during recovery failed:', refreshErr);
          }
        })();
      }
    };

    transcriber.startTranscribingAsync(
      () => {
        console.log('Conversation transcription started');
      },
      (err) => {
        console.error('Failed to start transcription:', err);
        alert('音声認識の開始に失敗しました。');
      }
    );

    transcriberRef.current = transcriber;

    // Schedule periodic token refresh
    refreshTimerRef.current = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL_MS);
  }, [refreshToken]);

  const stop = useCallback(() => {
    // Clear token refresh timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    speechConfigRef.current = null;

    const transcriber = transcriberRef.current;
    transcriberRef.current = null;
    if (transcriber) {
      transcriber.stopTranscribingAsync(
        () => {
          transcriber.close();
        },
        (err) => {
          console.error('Failed to stop transcription:', err);
          transcriber.close();
        }
      );
    }
  }, []);

  return { start, stop };
}
