import assert from 'node:assert/strict';
import { safeRpcUrl } from './common.mjs';

assert.equal(
  safeRpcUrl('http://127.0.0.1:19961'),
  'http://127.0.0.1:19961/',
);

assert.equal(
  safeRpcUrl('https://rpc.example.org'),
  'https://rpc.example.org/',
);

assert.throws(
  () => safeRpcUrl('http://100.104.37.96:19961'),
  /must use HTTPS/,
);

assert.equal(
  safeRpcUrl(
    'http://100.104.37.96:19961',
    { allowTailscaleHttp: true },
  ),
  'http://100.104.37.96:19961/',
);

for (const rejected of [
  'http://100.63.255.255:19961',
  'http://100.128.0.1:19961',
  'http://192.168.1.197:19961',
  'http://203.0.113.10:19961',
]) {
  assert.throws(
    () => safeRpcUrl(
      rejected,
      { allowTailscaleHttp: true },
    ),
    /must use HTTPS/,
    rejected,
  );
}

assert.throws(
  () => safeRpcUrl(
    'http://user:password@100.104.37.96:19961',
    { allowTailscaleHttp: true },
  ),
  /must not contain embedded credentials/,
);

console.log('safeRpcUrl Stage-D policy: PASS');
