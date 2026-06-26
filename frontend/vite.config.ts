import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = process.env.BACKEND_PORT || '8000';
const backendUrl = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Listen on all interfaces (needed for devtunnel)
    allowedHosts: ['all'], // Accept requests from devtunnel domain
    headers: {
      // Allow Teams to embed this page in an iframe
      'Content-Security-Policy': "frame-ancestors teams.microsoft.com *.teams.microsoft.com *.skype.com",
    },
    proxy: {
      '/ws': {
        target: backendUrl,
        ws: true,
      },
      '/export': {
        target: backendUrl,
      },
      '/api': {
        target: backendUrl,
      },
    },
    // SPA fallback: serve index.html for /teams/* routes
    historyApiFallback: true,
  },
  // Ensure Teams routes work after build (deploy behind a server that
  // serves index.html for unknown paths, e.g. Azure Static Web Apps).
  appType: 'spa',
});
