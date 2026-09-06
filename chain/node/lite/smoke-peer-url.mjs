import assert from 'node:assert/strict';
import { safePeerUrl } from './peer-url.mjs';

const tailscaleAllowed = { allowTailscaleHttp: true };

assert.equal(
  safePeerUrl('http://127.0.0.1:9944'),
  'http://127.0.0.1:9944/',
);
assert.equal(
  safePeerUrl('http://localhost:9944'),
  'http://localhost:9944/',
);
assert.equal(
  safePeerUrl('http://[::1]:9944'),
  'http://[::1]:9944/',
);
assert.equal(
  safePeerUrl('https://rpc.example.test'),
  'https://rpc.example.test/',
);

assert.throws(
  () => safePeerUrl('http://100.104.37.96:19961'),
  /HTTP_RPC_PEER_MUST_BE_LOCAL_OR_APPROVED_TAILSCALE/,
);

for (const hostname of [
  '100.64.0.0',
  '100.104.37.96',
  '100.127.255.255',
]) {
  const result = safePeerUrl(
    'http://' + hostname + ':19961',
    tailscaleAllowed,
  );

  assert.equal(new URL(result).hostname, hostname);
}

for (const hostname of [
  '100.63.255.255',
  '100.128.0.0',
  '192.168.1.197',
  '8.8.8.8',
]) {
  assert.throws(
    () => safePeerUrl(
      'http://' + hostname + ':19961',
      tailscaleAllowed,
    ),
    /HTTP_RPC_PEER_MUST_BE_LOCAL_OR_APPROVED_TAILSCALE/,
  );
}

assert.throws(
  () => safePeerUrl(
    'http://user:secret@100.104.37.96:19961',
    tailscaleAllowed,
  ),
  /RPC_PEER_CREDENTIALS_NOT_ALLOWED/,
);

assert.throws(
  () => safePeerUrl('file:///tmp/rpc'),
  /RPC_PEER_PROTOCOL_NOT_ALLOWED/,
);

console.log('Lite Tailscale peer URL policy: PASS');
