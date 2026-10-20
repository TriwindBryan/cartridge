// Hands ROM inspection to a worker thread (see inspect-worker.js). Falls back to doing it in-process if the worker can't start.
'use strict';
const { Worker } = require('worker_threads');
const rom = require('./rom');

/** Buffers come back from a worker as plain Uint8Arrays. */
const asBuffer = (u8) => (u8 && !Buffer.isBuffer(u8) && u8.buffer ? Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength) : u8);

function revive(info) {
  if (info.data) info.data = asBuffer(info.data);
  if (info.alt && info.alt.data) info.alt.data = asBuffer(info.alt.data);
  return info;
}

class Inspector {
  /** workerFile: path to inspect-worker.js (outside the .asar in a packaged app). */
  constructor(workerFile, log = () => {}) {
    this.workerFile = workerFile;
    this.log = log;
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    this.broken = false;
    this.idleTimer = null;
  }

  start() {
    if (this.worker || this.broken) return this.worker;
    try {
      const w = new Worker(this.workerFile);
      w.on('message', ({ id, info, error }) => {
        const p = this.pending.get(id);
        if (!p) return;
        this.pending.delete(id);
        if (error) p.reject(new Error(error)); else p.resolve(revive(info));
        this.idleSoon();
      });
      const fail = (e) => {
        this.log(`ROM checker stopped: ${e && e.message ? e.message : e}`);
        this.worker = null;
        // finish anything still waiting in-process
        const waiting = [...this.pending.values()];
        this.pending.clear();
        for (const p of waiting) rom.inspectRom(p.file).then(p.resolve, p.reject);
      };
      w.on('error', (e) => { this.broken = true; fail(e); });
      w.on('exit', (code) => { if (this.worker === w && code !== 0) fail(new Error(`exit ${code}`)); if (this.worker === w) this.worker = null; });
      this.worker = w;
    } catch (e) {
      this.broken = true;
      this.log(`ROM checker couldn't start, checking ROMs in the main process: ${e.message}`);
    }
    return this.worker;
  }

  /** Stop the thread after a quiet minute; it starts again on the next ROM. */
  idleSoon() {
    clearTimeout(this.idleTimer);
    if (this.pending.size) return;
    this.idleTimer = setTimeout(() => { if (!this.pending.size && this.worker) { const w = this.worker; this.worker = null; w.terminate().catch(() => {}); } }, 60000);
    if (this.idleTimer.unref) this.idleTimer.unref();
  }

  inspect(file) {
    const w = this.start();
    if (!w) return rom.inspectRom(file);
    clearTimeout(this.idleTimer);
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, file });
      w.postMessage({ id, file });
    });
  }

  close() {
    clearTimeout(this.idleTimer);
    if (this.worker) this.worker.terminate().catch(() => {});
    this.worker = null;
  }
}

module.exports = { Inspector, revive };
