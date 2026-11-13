/// <reference lib="webworker" />
import { parseVersion } from './parse';

export type WorkerIn = { id: string; urls: string[]; expectedBytes: number };
export type WorkerOut =
  | { type: 'progress'; value: number }
  | { type: 'done'; books: ReturnType<typeof parseVersion> }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => postMessage(m);

async function fetchText(url: string, expected: number): Promise<string> {
  const ctl = new AbortController();
  let stall = setTimeout(() => ctl.abort(), 30_000);
  const res = await fetch(url, { signal: ctl.signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    clearTimeout(stall);
    if (done) break;
    stall = setTimeout(() => ctl.abort(), 30_000);
    chunks.push(value);
    got += value.length;
    // The server may compress, so the real total is an estimate: cap at 90% until the download finishes.
    post({ type: 'progress', value: Math.min(0.9, got / expected) });
  }
  const all = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return new TextDecoder().decode(all).replace(/^﻿/, '');
}

onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { urls, expectedBytes } = e.data;
  let lastError = 'falha de rede';
  for (const url of urls) {
    try {
      const text = await fetchText(url, expectedBytes);
      const books = parseVersion(JSON.parse(text));
      post({ type: 'progress', value: 0.95 });
      post({ type: 'done', books });
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  post({ type: 'error', message: lastError });
};
