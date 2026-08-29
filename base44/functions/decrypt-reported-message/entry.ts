// Legacy DM escrow decryption endpoint — permanently disabled.
//
// SwapPulse direct messages are fail-closed end-to-end encrypted and new
// messages do not populate an admin-decryptable plaintext escrow. Keeping a
// callable decrypt path for historical ciphertext would contradict that privacy
// model, so this function remains only as an explicit tombstone.
export default async function (): Promise<Response> {
  return Response.json(
    { error: 'Direct-message escrow decryption is no longer available' },
    { status: 410 },
  );
}
