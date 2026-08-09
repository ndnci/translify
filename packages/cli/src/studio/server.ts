import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { StudioService, StudioTranslateInput } from './service.js';
import { studioHtml } from './ui.js';

export interface StartStudioServerOptions {
  service: StudioService;
  port?: number;
  host?: string;
}

export interface RunningStudioServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export async function startStudioServer(
  options: StartStudioServerOptions,
): Promise<RunningStudioServer> {
  const host = options.host ?? '127.0.0.1';
  const server = createServer((request, response) => {
    void routeRequest(options.service, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 4983, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const url = `http://${host}:${address.port}`;
  return {
    server,
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function openDefaultBrowser(url: string): void {
  const command = browserCommand(url, process.platform);
  const child = spawn(command.executable, command.args, {
    detached: true,
    stdio: 'ignore',
  });
  child.once('error', () => {
    // The server remains usable when a minimal/headless environment has no opener.
  });
  child.unref();
}

export function browserCommand(
  url: string,
  platform: typeof process.platform,
): { executable: string; args: string[] } {
  if (platform === 'darwin') return { executable: 'open', args: [url] };
  if (platform === 'win32') return { executable: 'cmd', args: ['/c', 'start', '', url] };
  return { executable: 'xdg-open', args: [url] };
}

async function routeRequest(
  service: StudioService,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'GET' && url.pathname === '/') {
      send(response, 200, studioHtml, 'text/html; charset=utf-8');
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/meta') {
      sendJson(response, 200, service.metadata);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/entries') {
      const group = requiredQuery(url, 'group');
      const language = requiredQuery(url, 'language');
      sendJson(response, 200, { entries: service.entries(group, language) });
      return;
    }
    if (request.method === 'PATCH' && url.pathname === '/api/entries') {
      const body = await readJson(request);
      service.update(
        requiredString(body, 'group'),
        requiredString(body, 'language'),
        requiredString(body, 'key'),
        requiredString(body, 'value', true),
      );
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/translate') {
      const body = await readJson(request);
      const input: StudioTranslateInput = {
        text: requiredString(body, 'text'),
        sourceLanguage: requiredString(body, 'sourceLanguage'),
        targetLanguage: requiredString(body, 'targetLanguage'),
        ...(body.suggestions !== undefined && { suggestions: Number(body.suggestions) }),
        ...(typeof body.candidate === 'string' && { candidate: body.candidate }),
      };
      sendJson(response, 200, await service.translate(input));
      return;
    }
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

function requiredQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value) throw new Error(`Missing query parameter: ${key}`);
  return value;
}

function requiredString(body: Record<string, unknown>, key: string, allowEmpty = false): string {
  const value = body[key];
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new Error(`Invalid field: ${key}`);
  }
  return value;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error('Request body is too large');
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function sendJson(response: ServerResponse, status: number, data: unknown): void {
  send(response, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function send(response: ServerResponse, status: number, body: string, type: string): void {
  response.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  response.end(body);
}
