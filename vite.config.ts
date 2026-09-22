import dns from 'node:dns';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
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

/**
 * Optional: resolve api.typesafe.ai with explicit DNS servers instead of the
 * system resolver. Needed in shells where Node gets no DNS configuration from
 * macOS (`scutil --dns` reports none; Node's `dns.getServers()` is 127.0.0.1).
 * Enabled by TYPESAFE_DNS_SERVERS=1.1.1.1,8.8.8.8 in .env.
 */
function explicitDnsAgent(servers: readonly string[]): https.Agent {
  const resolver = new dns.promises.Resolver();
  resolver.setServers([...servers]);
  const lookup: LookupFunction = (hostname, options, callback) => {
    resolver.resolve4(hostname).then(
      (addresses) => {
        const first = addresses[0];
        if (first === undefined) {
          callback(new Error(`No A records for ${hostname} from ${servers.join(', ')}`), [], 4);
          return;
        }
        if (options.all) callback(null, addresses.map((address) => ({ address, family: 4 })), 4);
        else callback(null, first, 4);
      },
      (error: Error) => callback(error, [], 4),
    );
  };
  return new https.Agent({ lookup });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.TYPESAFE_API_KEY;
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new Error('TYPESAFE_API_KEY is not set. Copy .env.example to .env.local and fill it in.');
  }
  const dnsServers = (env.TYPESAFE_DNS_SERVERS ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter((server) => server.length > 0);
  const agent = dnsServers.length > 0 ? explicitDnsAgent(dnsServers) : undefined;
  return {
    server: {
      port: 5173,
      proxy: {
        '/api/typesafe': {
          target: 'https://api.typesafe.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/typesafe/, ''),
          ...(agent === undefined ? {} : { agent }),
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
