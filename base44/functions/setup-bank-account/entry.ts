// setup-bank-account — stores or updates the user's bank account details
// (IBAN + BIC/Swift) for the crypto-off flow. The IBAN and BIC are
// AES-256-GCM encrypted with APP_PASSWORD_ENCRYPTION_KEY before storage.
// Only masked values are returned to the frontend.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { encryptWithServerKey } from '../../shared/walletCrypto.ts';
import { validateIban, validateBic, maskIban, maskBic } from '../../shared/walletEscrow.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { iban, bic, account_holder_name, bank_name } = body;

    if (!iban) return Response.json({ error: 'IBAN is required' }, { status: 400 });
    if (!bic) return Response.json({ error: 'BIC/Swift code is required' }, { status: 400 });

    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    const cleanBic = bic.replace(/\s/g, '').toUpperCase();

    if (!validateIban(cleanIban)) {
      return Response.json({ error: 'Invalid IBAN checksum' }, { status: 400 });
    }
    if (!validateBic(cleanBic)) {
      return Response.json({ error: 'Invalid BIC/Swift format' }, { status: 400 });
    }

    // Encrypt the bank details
    const ibanCipher = await encryptWithServerKey(cleanIban);
    const bicCipher = await encryptWithServerKey(cleanBic);
    const ibanMasked = maskIban(cleanIban);
    const bicMasked = maskBic(cleanBic);

    // Deactivate existing bank accounts
    const existing = await base44.entities.BankAccount
      .filter({ did, active: true }).catch(() => []);
    for (const acct of existing) {
      await base44.entities.BankAccount.update(acct.id, { active: false });
    }

    // Create the new bank account record
    const bankAccount = await base44.entities.BankAccount.create({
      did,
      iban_cipher: ibanCipher,
      bic_cipher: bicCipher,
      iban_masked: ibanMasked,
      bic_masked: bicMasked,
      account_holder_name: account_holder_name || '',
      bank_name: bank_name || '',
      active: true,
      created_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      bank_account: {
        iban_masked: ibanMasked,
        bic_masked: bicMasked,
        account_holder_name: account_holder_name || '',
        bank_name: bank_name || '',
      },
    });
  } catch (error: any) {
    console.error('setup-bank-account error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}