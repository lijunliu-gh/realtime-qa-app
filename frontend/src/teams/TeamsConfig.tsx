/**
 * Teams tab configuration page.
 * Required by Teams manifest for configurable tabs.
 * Since our side panel doesn't need user configuration, this just
 * auto-saves and shows a "ready" message.
 */
import { useEffect } from 'react';
import { app, pages } from '@microsoft/teams-js';

export default function TeamsConfig() {
  useEffect(() => {
    (async () => {
      await app.initialize();
      pages.config.registerOnSaveHandler((saveEvent) => {
        pages.config.setConfig({
          entityId: 'realtimeqa',
          contentUrl: `${window.location.origin}/teams/sidepanel`,
          suggestedDisplayName: 'RealtimeQA',
        });
        saveEvent.notifySuccess();
      });
      pages.config.setValidityState(true);
    })();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: 'var(--text-primary, #242424)',
      }}
    >
      <h2 style={{ color: 'var(--brand, #5b5fc7)', fontWeight: 600 }}>RealtimeQA</h2>
      <p style={{ color: 'var(--text-secondary, #4d4d4d)' }}>
        Click "Save" to add the Real-time Q&amp;A panel to your meeting.
      </p>
      <p style={{ color: 'var(--text-dim, #8a8a8a)', fontSize: '0.9rem', maxWidth: 420 }}>
        During the meeting, open the side panel to see live Q&amp;A with
        Microsoft Learn citations.
      </p>
    </div>
  );
}
