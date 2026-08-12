// Generates verifier links to a firehose / AT Protocol record explorer.
// SwapPulse simulates AT Protocol, so the explorer base is a single config
// point — swap FIREHOSE_EXPLORER_BASE for a real resolver when one is live.
const FIREHOSE_EXPLORER_BASE = 'https://pdsls.dev/?uri=';

export function useFirehoseExplorer() {
  const generateVerifierLink = (uri) => `${FIREHOSE_EXPLORER_BASE}${encodeURIComponent(uri)}`;
  return { generateVerifierLink, explorerBase: FIREHOSE_EXPLORER_BASE };
}