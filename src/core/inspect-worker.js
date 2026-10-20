// Runs in a worker thread: reads and fingerprints ROM files, so a slow drive or a big file never freezes the window.
'use strict';
const { parentPort } = require('worker_threads');
const rom = require('./rom');

parentPort.on('message', async ({ id, file }) => {
  try {
    parentPort.postMessage({ id, info: await rom.inspectRom(file) });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message });
  }
});
