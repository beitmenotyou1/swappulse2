import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { ec } from 'starknet';
import { normalizeHex } from './common.mjs';

const outputFile = path.resolve(
  process.env.SWAPPULSE_USER_KEY_FILE || path.join(process.cwd(), '../../infra/secrets/test-identity.key'),
);

const privateKey = `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString('hex')}`;
const publicKey = normalizeHex(ec.starkCurve.getStarkKey(privateKey), 'public key');

await fs.mkdir(path.dirname(outputFile), { recursive: true, mode: 0o700 });
await fs.chmod(path.dirname(outputFile), 0o700).catch(() => {});
try {
  await fs.writeFile(outputFile, `${privateKey}\n`, { flag: 'wx', mode: 0o600 });
} catch (error) {
  if (error?.code === 'EEXIST') {
    throw new Error(`Refusing to overwrite existing signer file: ${outputFile}`);
  }
  throw error;
}
await fs.chmod(outputFile, 0o600);

console.log(JSON.stringify({
  ok: true,
  public_key: publicKey,
  signer_file: outputFile,
  note: 'Only the public key is printed. The private Stark test key was written locally with mode 0600 and must never be pasted into Base44.',
}, null, 2));
