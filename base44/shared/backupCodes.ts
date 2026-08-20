// backupCodes — generation and verification of one-time 2FA backup recovery codes.
// Raw codes are never persisted; only their SHA-256 hashes are stored in the
// BackupCode entity. Used by setup-2fa (generate on enable), verify-login-code
// (verify at login), and SecuritySection (regenerate).

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0/O/1/I)
const CODE_LENGTH = 8;
const NUM_CODES = 10;

export function generateBackupCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function generateBackupCodes(count = NUM_CODES): string[] {
  return Array.from({ length: count }, () => generateBackupCode());
}

export async function hashBackupCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.toUpperCase().trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Persist backup codes for a user via service role. Deletes any existing
// unused codes first so regeneration replaces the old set.
export async function persistBackupCodes(svc: any, userId: string, codes: string[]): Promise<void> {
  // Delete existing unused backup codes for this user
  const existing = await svc.entities.BackupCode.filter({ used: false }, '-created_date', 100).catch(() => []);
  // Note: created_by_id is set automatically by the platform to the calling user's ID.
  // Since we're using asServiceRole, we need to filter by created_by_id manually.
  for (const c of existing) {
    if (c.created_by_id === userId) {
      await svc.entities.BackupCode.delete(c.id).catch(() => {});
    }
  }
  const hashes = await Promise.all(codes.map((c) => hashBackupCode(c)));
  await svc.entities.BackupCode.bulkCreate(
    hashes.map((h) => ({ code_hash: h, used: false, created_by_id: userId }))
  );
}

// Verify a backup code against all unused codes for a user. If matched, mark
// it as used and return true. Returns false if no match.
export async function verifyBackupCode(svc: any, userId: string, code: string): Promise<boolean> {
  const hash = await hashBackupCode(code);
  const candidates = await svc.entities.BackupCode.filter({ used: false }, '-created_date', 100).catch(() => []);
  for (const c of candidates) {
    if (c.created_by_id === userId && c.code_hash === hash) {
      await svc.entities.BackupCode.update(c.id, { used: true, used_at: new Date().toISOString() }).catch(() => {});
      return true;
    }
  }
  return false;
}