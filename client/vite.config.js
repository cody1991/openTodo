import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ant-design/charts')) return 'charts';
            if (id.includes('@fullcalendar')) return 'calendar';
            if (id.includes('date-holidays') || id.includes('date-easter')) return 'holidays';
            if (id.includes('bytemd') || id.includes('@bytemd')) return 'editor';
            if (id.includes('antd') || id.includes('@ant-design')) return 'antd';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor';
          }
        },
      },
    },
  },
});
