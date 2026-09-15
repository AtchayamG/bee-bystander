import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5175,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      }
    }
  }
});
