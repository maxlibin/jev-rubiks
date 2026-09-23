import type { Plugin as RolldownPlugin } from 'rolldown';
import { defineConfig, loadEnv } from 'vite';

/**
 * cubejs/lib/solve.js only calls `require`, so the dependency optimizer does
 * not treat it as CommonJS and rewrites its top-level `this` to `undefined`,
 * which breaks `this.Cube || require('./cube')`. Drop the `this.Cube` half.
 */
const cubejsSolveFix: RolldownPlugin = {
  name: 'cubejs-solve-this-fix',
  transform(code, id) {
    if (!/cubejs[\\/]lib[\\/]solve\.js$/.test(id)) return null;
    const needle = "Cube = this.Cube || require('./cube');";
    if (!code.includes(needle)) {
      throw new Error(`cubejs-solve-this-fix: expected "${needle}" in ${id}; the package changed`);
    }
    return { code: code.replace(needle, "Cube = require('./cube');"), map: null };
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.TYPESAFE_API_KEY;
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new Error('TYPESAFE_API_KEY is not set. Copy .env.example to .env.local and fill it in.');
  }
  return {
    server: {
      port: 5173,
      proxy: {
        '/api/typesafe': {
          target: 'https://api.typesafe.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/typesafe/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
            });
            // http-proxy answers a bodiless 502 on upstream failure; say why, in the
            // terminal and in the response body so the browser can show it.
            proxy.on('error', (error, req, res) => {
              const detail = { event: 'typesafe_proxy_error', method: req.method, url: req.url, error: error.message };
              console.error(JSON.stringify(detail));
              if ('writeHead' in res && !res.headersSent) {
                res.writeHead(502, { 'content-type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error: 'The dev-server proxy could not reach api.typesafe.ai',
                    cause: error.message,
                    upstream: 'https://api.typesafe.ai' + (req.url ?? ''),
                  }),
                );
              }
            });
          },
        },
      },
    },
    optimizeDeps: { include: ['cubejs'], rolldownOptions: { plugins: [cubejsSolveFix] } },
  };
});
