'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../developer/check-image-health.js'), 'utf8');
const functionSource = source.slice(source.indexOf('async function checkUrl('), source.indexOf('async function runPool('));

async function run(responses) {
  const calls = [], cancelled = [];
  const context = {
    AbortSignal: { timeout(ms) { assert.equal(ms, 15000); return AbortSignal.timeout(ms); } },
    fetch: async (url, options) => {
      calls.push(options);
      assert(options.signal instanceof AbortSignal);
      const result = responses.shift();
      if (result instanceof Error) throw result;
      assert(result, 'Unexpected extra request');
      return {
        ...result, ok: result.status >= 200 && result.status < 300,
        url, headers: { get: () => result.type || '' },
        body: { cancel: async () => { cancelled.push(result.status); } }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(functionSource, context);
  const result = await context.checkUrl('https://example.test/image.jpg');
  return { result, calls, cancelled };
}

(async () => {
  let r = await run([{ status: 200, type: 'image/jpeg' }]);
  assert.equal(r.result.ok, true); assert.deepEqual(r.cancelled, [200]);
  for (const status of [400, 403, 405]) {
    r = await run([{ status }, { status: 206, type: 'image/png' }]);
    assert.equal(r.result.ok, true);
    assert.equal(r.calls[1].method, 'GET');
    assert.equal(r.calls[1].headers.Range, 'bytes=0-1023');
    assert.equal(r.calls[0].signal, r.calls[1].signal);
    assert.deepEqual(r.cancelled, [status, 206]);
  }
  for (const type of ['', 'text/html']) {
    r = await run([{ status: 200, type }]);
    assert.equal(r.result.ok, false, 'Non-image responses must not pass');
  }
  r = await run([{ status: 404, type: 'image/jpeg' }]);
  assert.equal(r.result.ok, false); assert.equal(r.calls.length, 1);
  r = await run([new Error('request timed out')]);
  assert.equal(r.result.ok, false); assert.equal(r.result.status, 0);
  assert.equal(r.result.error, 'request timed out');
  console.log('PASS: image health, fallback, bounded requests, body cleanup and transport errors.');
})().catch(error => { console.error(error); process.exitCode = 1; });
