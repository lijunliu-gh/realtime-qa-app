import { useEffect, useRef, useState } from 'react';
import { app, meeting } from '@microsoft/teams-js';

/**
 * Hook that listens to Teams meeting live captions and invokes onResult
 * with each caption segment (speaker + text). This replaces the Azure
 * Speech SDK hook when running inside a Teams Side Panel.
 *
 * Teams Client SDK provides real-time caption events with speaker identity
 * (display name from the meeting roster), giving < 1s latency.
 */

interface TeamsTranscriptOptions {
  onResult: (text: string, speaker?: string) => void;
  enabled?: boolean;
}

export function useTeamsTranscript({ onResult, enabled = true }: TeamsTranscriptOptions) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const handlerRegistered = useRef(false);

  // Initialize Teams SDK
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await app.initialize();
        if (!cancelled) setIsInitialized(true);
      } catch (err) {
        if (!cancelled) setError(`Teams SDK init failed: ${err}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Register caption handler
  useEffect(() => {
    if (!isInitialized || !enabled || handlerRegistered.current) return;

    // Buffer to accumulate partial captions per speaker and emit on final.
    const partialBuffer = new Map<string, string>();

    try {
      // The Teams SDK meeting namespace exposes caption registration.
      // Cast to access the handler API which varies across SDK versions.
      const meetingNs = meeting as any;
      const registerFn = meetingNs.registerMeetingCaptionsHandler
        || meetingNs.meeting?.registerMeetingCaptionsHandler;
      if (!registerFn) {
        setError('Caption handler API not available in this Teams SDK version');
        return;
      }
      registerFn({
        captionsReceived: (captions: any) => {
          const entries = Array.isArray(captions) ? captions : [captions];
          for (const caption of entries) {
            const speaker = caption.speaker?.displayName
              || caption.speakerName
              || caption.speaker
              || '不明';
            const text = (caption.text || caption.captionText || '').trim();

            if (!text) continue;

            // If this is a final/complete caption, emit it.
            if (caption.isFinal !== false) {
              partialBuffer.delete(speaker);
              onResultRef.current(text, speaker);
            } else {
              // Partial — store for now (we'll get a final one later).
              partialBuffer.set(speaker, text);
            }
          }
        },
      });
      handlerRegistered.current = true;
    } catch (err: any) {
      setError(`Failed to register caption handler: ${err}`);
    }

    return () => {
      // The Teams SDK doesn't expose an unregister; the handler lives
      // until the tab/panel is closed.
      handlerRegistered.current = false;
    };
  }, [isInitialized, enabled]);

  return { isInitialized, error };
}

/**
 * Detect whether we're running inside Teams (vs standalone browser).
 */
export function useIsTeamsContext(): boolean | null {
  const [isTeams, setIsTeams] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      try {
        await app.initialize();
        const ctx = await app.getContext();
        setIsTeams(!!ctx?.page?.frameContext);
      } catch {
        setIsTeams(false);
      }
    })();
  }, []);
  return isTeams;
}
