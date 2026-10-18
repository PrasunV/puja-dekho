import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../server/app.js';

const pujaFile = new URL('../../public/data/pujas.json', import.meta.url);
/** Pujas with an exact pin (the ones the API accepts queue reports for in tests). */
export const PUJAS = JSON.parse(fs.readFileSync(pujaFile, 'utf8')).filter((puja) => puja.ck);

/**
 * Start an isolated server on a random port with a fake clock and a throwaway database.
 * @param {{ env?: Record<string, string> }} [options]
 */
export async function boot({ env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-'));
  let clock = Date.parse('2026-10-17T20:00:00+05:30');
  const instance = createApp({ env: { DATA_DIR: dir, SECRET: 'test-secret', ...env }, now: () => clock });
  const server = await new Promise((resolve) => {
    const listening = instance.app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  /** A fake browser with its own cookie jar. */
  const client = () => {
    const jar = {};
    const call = async (method, url, body) => {
      const cookie = Object.entries(jar)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
      const res = await fetch(base + url, {
        method,
        headers: { 'content-type': 'application/json', cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      for (const header of res.headers.getSetCookie()) {
        const [pair] = header.split(';');
        const [name, value] = pair.split(/=(.*)/s);
        jar[name] = value;
      }
      const isJson = (res.headers.get('content-type') || '').includes('json');
      return { status: res.status, headers: res.headers, body: isJson ? await res.json() : await res.text() };
    };
    return { jar, get: (url) => call('GET', url), post: (url, body) => call('POST', url, body ?? {}) };
  };

  return {
    instance,
    client,
    advance: (ms) => {
      clock += ms;
    },
    close: () => {
      server.closeAllConnections();
      server.close();
      instance.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
