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
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor libraries into their own long-cached
        // chunks so an app-code deploy doesn't invalidate React/MUI for users.
        // NOTE: @mui/x-date-pickers and xlsx are deliberately NOT grouped here —
        // they're heavy and only reached via lazy routes / on-demand imports, so
        // we let Rollup keep them in their own chunks instead of forcing them
        // into an eagerly-loaded vendor bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@mui/x-date-pickers') || id.includes('xlsx')) return undefined;
          if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
});
