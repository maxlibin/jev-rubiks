import { TypeSafeClient } from '@typesafe-ai/sdk';

/** Pinned: aliases move between releases and the thresholds are tuned per version. */
export const JEV_MODEL = 'jev-1.13.0';

export class MissingApiKeyError extends Error {
  constructor() {
    super('TYPESAFE_API_KEY is not set; put it in .env.local');
    this.name = 'MissingApiKeyError';
  }
}

export type JevClientConfig = {
  readonly baseURL: string;
  readonly apiKey: string;
  readonly allowBrowser: boolean;
};

export function createJevClient(config: JevClientConfig): TypeSafeClient {
  return new TypeSafeClient({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    defaultModel: JEV_MODEL,
    dangerouslyAllowBrowser: config.allowBrowser,
  });
}

/** Browser: talks to the Vite proxy, which replaces the placeholder key with the real one. */
export function createBrowserJevClient(): TypeSafeClient {
  return createJevClient({ baseURL: `${window.location.origin}/api/typesafe`, apiKey: 'proxied', allowBrowser: true });
}

/**
 * Node scripts and live tests: the key from the environment, talking to the API
 * directly — or to `TYPESAFE_BASE_URL` when set (the SDK's own variable), e.g.
 * a running dev server's proxy: TYPESAFE_BASE_URL=http://localhost:5173/api/typesafe.
 */
export function createNodeJevClient(): TypeSafeClient {
  const apiKey = process.env['TYPESAFE_API_KEY'];
  if (apiKey === undefined || apiKey.trim() === '') throw new MissingApiKeyError();
  const baseURL = process.env['TYPESAFE_BASE_URL'];
  return createJevClient({
    baseURL: baseURL === undefined || baseURL.trim() === '' ? 'https://api.typesafe.ai' : baseURL,
    apiKey,
    allowBrowser: false,
  });
}
