import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        verify: resolve(__dirname, 'verify.html'),
      },
    },
  },
  plugins: [
    {
      name: 'verify-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/verify') && !req.url.startsWith('/verify.html')) {
            const queryIndex = req.url.indexOf('?');
            req.url = '/verify.html' + (queryIndex !== -1 ? req.url.substring(queryIndex) : '');
          }
          next();
        });
      },
    },
  ],
});
