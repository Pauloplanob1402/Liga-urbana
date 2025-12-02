import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Garante que process.env funcione no navegador para evitar erros com bibliotecas antigas
    'process.env': {}
  }
});