import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@sim-core': '/src/sim-core',
      '@fdm-jsbsim': '/src/fdm-jsbsim',
      '@frames': '/src/frames',
      '@world-cesium': '/src/world-cesium',
      '@aircraft-render': '/src/aircraft-render',
      '@input': '/src/input',
      '@ui': '/src/ui',
      '@asset-pipeline': '/src/asset-pipeline'
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
