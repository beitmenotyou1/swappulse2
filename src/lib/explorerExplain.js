// Plain-language explanation builders for the blockchain explorer.
// Deterministic, template-based human-written text (NOT AI) composed from the
// data fields. All strings are fully localized via the i18n `t` function with
// {placeholder} interpolation. Returns an empty string if insufficient data.

import { formatPls, formatNumber } from './explorerFormat';

// Build a plain-language explanation for a transaction.
// Returns a localized string describing what the transaction did.
export function explainTransaction(tx, t) {
  if (!tx) return '';
  const from = truncateAddr(tx.from_address);
  const to = tx.to_address ? truncateAddr(tx.to_address) : '';
  const amount = formatPls(tx.value_wei);

  // Contract creation
  if (!tx.to_address) {
    if (tx.status === 'failed') return t('explainer.tx.failed');
    return t('explainer.tx.contractCreation', { address: tx.created_contract || '—' });
  }

  // Failed transaction
  if (tx.status === 'failed') {
    return t('explainer.tx.failed');
  }

  // Zero-value contract interaction
  if (tx.value_wei === '0' || tx.value_wei === 0) {
    return t('explainer.tx.zero', { from, to });
  }

  // Value transfer (possibly to a contract)
  const isContract = tx.to_address; // we don't have is_contract flag on tx; treat all as transfer
  if (amount && amount !== '0') {
    return t('explainer.tx.transfer', { amount, from, to });
  }

  return '';
}

// Build a plain-language explanation for a block.
export function explainBlock(block, t) {
  if (!block) return '';
  const number = formatNumber(block.block_number);
  const txCount = block.tx_count ?? 0;
  const gasUsed = formatNumber(block.gas_used);
  const miner = truncateAddr(block.miner);

  if (!txCount) {
    return t('explainer.block.empty', { number });
  }
  return t('explainer.block.summary', { number, txCount: formatNumber(txCount), gasUsed, miner });
}

// Truncate an address for readability in explanation text: 0x1234…abcd
function truncateAddr(addr) {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}