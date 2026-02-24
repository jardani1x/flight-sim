import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/flight-sim/',
  root: '.',
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@sim-core': resolve(__dirname, 'src/sim-core'),
      '@fdm-jsbsim': resolve(__dirname, 'src/fdm-jsbsim'),
      '@frames': resolve(__dirname, 'src/frames'),
      '@world-cesium': resolve(__dirname, 'src/world-cesium'),
      '@aircraft-render': resolve(__dirname, 'src/aircraft-render'),
      '@input': resolve(__dirname, 'src/input'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@asset-pipeline': resolve(__dirname, 'src/asset-pipeline')
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
