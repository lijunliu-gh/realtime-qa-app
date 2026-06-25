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

/**
 * Speech recognition hook using Azure Speech SDK.
 * Supports multi-language and speaker diarization.
 */
export function useSpeechRecognition({ onResult, language = 'ja-JP' }: SpeechRecognitionOptions) {
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const languageRef = useRef(language);
  languageRef.current = language;

  const start = useCallback(async () => {
    // Avoid double-start.
    if (recognizerRef.current) {
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

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognized = (_sender, event) => {
      if (
        event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech &&
        event.result.text.trim()
      ) {
        // Try to extract speaker ID from JSON properties if available.
        let speaker: string | undefined;
        try {
          const json = event.result.properties.getProperty(
            SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
          );
          if (json) {
            const parsed = JSON.parse(json);
            const speakerId = parsed?.Speaker?.Id || parsed?.SpeakerId;
            if (speakerId) {
              speaker = `Speaker ${speakerId}`;
            }
          }
        } catch {
          // Ignore parse errors.
        }
        onResultRef.current(event.result.text.trim(), speaker);
      }
    };

    recognizer.canceled = (_sender, event) => {
      if (event.reason === SpeechSDK.CancellationReason.Error) {
        console.error('Speech recognition error:', event.errorDetails);
      }
    };

    recognizer.startContinuousRecognitionAsync(
      () => {
        console.log('Speech recognition started');
      },
      (err) => {
        console.error('Failed to start speech recognition:', err);
        alert('音声認識の開始に失敗しました。');
      }
    );

    recognizerRef.current = recognizer;
  }, []);

  const stop = useCallback(() => {
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          recognizer.close();
        },
        (err) => {
          console.error('Failed to stop speech recognition:', err);
          recognizer.close();
        }
      );
    }
  }, []);

  return { start, stop };
}
