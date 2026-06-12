import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the Express backend during development.
      '/api': {
        target: 'https://taskplanner-mor2.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
