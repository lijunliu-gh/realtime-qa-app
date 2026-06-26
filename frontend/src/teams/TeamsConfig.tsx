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
    <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
      <h2>RealtimeQA</h2>
      <p>Click "Save" to add the Real-time Q&A panel to your meeting.</p>
      <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
        During the meeting, open the side panel to see live Q&A with
        Microsoft Learn citations.
      </p>
    </div>
  );
}
