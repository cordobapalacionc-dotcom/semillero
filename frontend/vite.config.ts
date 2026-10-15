import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// xfwd: reenvía la IP real del visitante (X-Forwarded-For). Sin esto todas las peticiones
// llegarían a la API como 127.0.0.1 y el límite de intentos de login sería compartido.
const api = { target: 'http://localhost:4000', xfwd: true };

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
