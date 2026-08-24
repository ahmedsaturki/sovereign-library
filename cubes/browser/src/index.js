import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { accessSync } from 'node:fs';
import { tmpdir, release } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { request } from 'node:http';

export class BrowserCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'BrowserCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
  }
}

export function validateUrl(value) {
  if (typeof value !== 'string' || value.length === 0) throw new BrowserCubeError('INVALID_URL', 'URL must be a non-empty string');
  let url;
  try { url = new URL(value); } catch { throw new BrowserCubeError('INVALID_URL', 'URL is not valid'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new BrowserCubeError('UNSUPPORTED_PROTOCOL', `Unsupported URL protocol: ${url.protocol}`);
  return url;
}

export function createSessionState() {
  return { state: 'created', browserPid: null, endpoint: null, targetId: null, startedAt: null, closedAt: null };
}

export function transition(state, next) {
  const allowed = {
    created: ['starting', 'closed'],
    starting: ['running', 'failed', 'closed'],
    running: ['closing', 'failed'],
    failed: ['closing', 'closed'],
    closing: ['closed'],
    closed: []
  };
  if (!allowed[state.state]?.includes(next)) throw new BrowserCubeError('INVALID_LIFECYCLE', `Cannot transition ${state.state} -> ${next}`);
  return { ...state, state: next };
}

function isWsl() {
  return process.platform === 'linux' && /microsoft|wsl/i.test(release());
}

async function freePort(host = '127.0.0.1') {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new BrowserCubeError('PORT_DISCOVERY_FAILED', 'Could not discover a free port')));
    });
  });
}

function httpJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new BrowserCubeError('HTTP_ERROR', `HTTP ${res.statusCode}`, { retryable: true }));
        try { resolve(JSON.parse(body)); } catch { reject(new BrowserCubeError('INVALID_JSON', 'Browser endpoint returned invalid JSON')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new BrowserCubeError('TIMEOUT', 'Browser endpoint timed out', { retryable: true })));
    req.on('error', reject);
    req.end();
  });
}

class CdpConnection {
  constructor(endpoint, timeoutMs) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws = null;
  }

  async connect() {
    if (typeof WebSocket !== 'function') throw new BrowserCubeError('WEBSOCKET_UNAVAILABLE', 'Node.js WebSocket is unavailable');
    this.ws = new WebSocket(this.endpoint);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new BrowserCubeError('CDP_TIMEOUT', 'Timed out connecting to CDP', { retryable: true })), this.timeoutMs);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
      this.ws.addEventListener('error', event => { clearTimeout(timer); reject(new BrowserCubeError('CDP_CONNECT_FAILED', String(event?.message || 'CDP connection failed'), { retryable: true })); });
      this.ws.addEventListener('message', event => this.#message(String(event.data)));
      this.ws.addEventListener('close', () => this.#closed());
    });
  }

  #message(text) {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.id !== undefined) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.error) pending.reject(new BrowserCubeError('CDP_COMMAND_FAILED', msg.error.message || 'CDP command failed'));
      else pending.resolve(msg.result);
      return;
    }
    for (const handler of this.listeners.get(msg.method) || []) handler(msg.params ?? {}, msg);
  }

  #closed() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new BrowserCubeError('CDP_CLOSED', 'CDP connection closed', { retryable: true }));
    }
    this.pending.clear();
  }

  on(method, handler) {
    const list = this.listeners.get(method) || [];
    list.push(handler);
    this.listeners.set(method, list);
    return () => this.listeners.set(method, list.filter(x => x !== handler));
  }

  command(method, params = {}, sessionId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new BrowserCubeError('CDP_NOT_CONNECTED', 'CDP is not connected', { retryable: true }));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BrowserCubeError('CDP_TIMEOUT', `CDP command timed out: ${method}`, { retryable: true }));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  async close() {
    if (!this.ws) return;
    try { this.ws.close(); } catch {}
    this.ws = null;
  }
}

export class BrowserSession {
  constructor(options = {}) {
    this.options = {
      executablePath: options.executablePath || null,
      headless: options.headless !== false,
      timeoutMs: options.timeoutMs ?? 15000,
      host: options.host || '127.0.0.1',
      userDataDir: options.userDataDir || null,
      extraArgs: options.extraArgs || []
    };
    this.process = null;
    this.profile = null;
    this.port = null;
    this.cdp = null;
    this.targetId = null;
    this.sessionId = null;
    this.closed = false;
  }

  async start() {
    if (this.process) return this;
    this.port = await freePort(this.options.host);
    this.profile = this.options.userDataDir || await mkdtemp(join(tmpdir(), 'sovereign-browser-'));
    const executable = this.options.executablePath || BrowserSession.findExecutable();
    if (!executable) throw new BrowserCubeError('BROWSER_NOT_FOUND', 'No Chromium-family browser found. Pass executablePath explicitly.');
    const args = [`--remote-debugging-port=${this.port}`, `--user-data-dir=${this.profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync', '--disable-dev-shm-usage', ...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(this.options.headless ? ['--headless=new'] : []), ...this.options.extraArgs, 'about:blank'];
    this.process = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    const started = Date.now();
    while (Date.now() - started < this.options.timeoutMs) {
      if (this.process.exitCode !== null) throw new BrowserCubeError('BROWSER_EXITED', `Browser exited with code ${this.process.exitCode}`, { retryable: true });
      try {
        const version = await httpJson(`http://${this.options.host}:${this.port}/json/version`, 1000);
        this.cdp = new CdpConnection(version.webSocketDebuggerUrl, this.options.timeoutMs);
        await this.cdp.connect();
        const target = await this.cdp.command('Target.createTarget', { url: 'about:blank' });
        this.targetId = target.targetId;
        const attached = await this.cdp.command('Target.attachToTarget', { targetId: this.targetId, flatten: true });
        this.sessionId = attached.sessionId;
        await this.#enablePageDomains();
        return this;
      } catch (error) {
        if (Date.now() - started >= this.options.timeoutMs) throw error;
        await new Promise(r => setTimeout(r, 100));
      }
    }
    throw new BrowserCubeError('START_TIMEOUT', 'Browser did not expose CDP before timeout', { retryable: true });
  }

  static findExecutable() {
    const candidates = process.platform === 'win32'
      ? [
          process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
          process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
          process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
          process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe')
        ]
      : isWsl()
        ? [
            '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
            '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
            '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium'
          ]
        : process.platform === 'darwin'
          ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
          : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
    return candidates.filter(Boolean).find(path => {
      try { accessSync(path); return true; } catch { return false; }
    }) || null;
  }

  async #enablePageDomains() {
    await this.#cmd('Page.enable');
    await this.#cmd('Runtime.enable');
  }

  #cmd(method, params = {}) { return this.cdp.command(method, params, this.sessionId); }

  async navigate(url) { validateUrl(url); return await this.#cmd('Page.navigate', { url }); }

  async evaluate(expression, returnByValue = true) {
    if (typeof expression !== 'string' || !expression) throw new BrowserCubeError('INVALID_EXPRESSION', 'Expression must be a non-empty string');
    const result = await this.#cmd('Runtime.evaluate', { expression, returnByValue, awaitPromise: true });
    if (result.exceptionDetails) throw new BrowserCubeError('EVALUATION_FAILED', result.exceptionDetails.text || 'Page evaluation failed');
    return result.result?.value;
  }

  async metadata() { return await this.evaluate('({ title: document.title, url: location.href, readyState: document.readyState })'); }

  async screenshot({ format = 'png', quality } = {}) {
    const result = await this.#cmd('Page.captureScreenshot', { format, ...(quality == null ? {} : { quality }) });
    return Buffer.from(result.data, 'base64');
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    try { if (this.cdp && this.targetId) await this.cdp.command('Target.closeTarget', { targetId: this.targetId }); } catch {}
    try { await this.cdp?.close(); } catch {}
    if (this.process && this.process.exitCode === null) {
      try { this.process.kill(); } catch {}
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1000);
        this.process.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
    if (this.profile && !this.options.userDataDir) {
      try { await rm(this.profile, { recursive: true, force: true }); } catch {}
    }
    this.process = null;
  }
}

export async function launch(options = {}) {
  const session = new BrowserSession(options);
  try { return await session.start(); }
  catch (error) { await session.close(); throw error; }
}