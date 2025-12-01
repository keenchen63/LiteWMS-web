import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
    // 支持直接访问 /mfa 路径
    historyApiFallback: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库单独打包
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 将 xlsx 库单独打包（较大）
          'xlsx': ['xlsx'],
          // 将 lucide-react 图标库单独打包
          'icons': ['lucide-react'],
        },
      },
    },
    // 提高 chunk 大小警告阈值到 1000KB（因为我们已经做了代码分割）
    chunkSizeWarningLimit: 1000,
  },
});

