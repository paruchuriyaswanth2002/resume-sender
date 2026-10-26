import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the browser talks only to Vite (5173); /api is proxied to Express (5000).
// That keeps cookies same-origin, exactly like production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
