// useWalletConnect — initializes the WalletConnect SignClient (wallet side)
// and provides pairing, approval, and session management for read-only
// dApp connections. Only read-only JSON-RPC methods are supported; all
// signing requests are rejected.

import { useState, useEffect, useCallback, useRef } from 'react';
import { WALLETCONNECT_PROJECT_ID, WALLETCONNECT_RELAY_URL } from '@/lib/walletconnectConfig';
import { useToast } from '@/components/ui/use-toast';

let _signClient = null;
let _initPromise = null;

const READ_ONLY_METHODS = [
  'eth_accounts',
  'eth_getBalance',
  'eth_getCode',
  'eth_blockNumber',
  'eth_chainId',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
];

export function useWalletConnect(walletAddress) {
  const [client, setClient] = useState(_signClient);
  const [sessions, setSessions] = useState([]);
  const [pairing, setPairing] = useState(false);
  const [pendingProposal, setPendingProposal] = useState(null);
  const { toast } = useToast();
  const addressRef = useRef(walletAddress);
  addressRef.current = walletAddress;

  // Initialize SignClient once
  useEffect(() => {
    if (!WALLETCONNECT_PROJECT_ID) return;
    if (_signClient) { setClient(_signClient); setSessions(_signClient.session.keys.map(k => _signClient.session.get(k))); return; }
    if (_initPromise) return;

    let cancelled = false;
    (async () => {
      try {
        const SignClient = (await import('@walletconnect/sign-client')).default;
        _initPromise = SignClient.init({
          projectId: WALLETCONNECT_PROJECT_ID,
          relayUrl: WALLETCONNECT_RELAY_URL,
          metadata: {
            name: 'SwapPulse Wallet',
            description: 'SwapPulse custodial wallet — read-only dApp browser',
            url: window.location.origin,
            icons: [`${window.location.origin}/icon-192.png`],
          },
        });
        const sc = await _initPromise;
        _signClient = sc;
        if (!cancelled) {
          setClient(sc);
          setSessions(sc.session.keys.map(k => sc.session.get(k)));
        }
      } catch (e) {
        console.error('WC init failed:', e);
      } finally {
        _initPromise = null;
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Wire up event handlers
  useEffect(() => {
    if (!client) return;

    const onProposal = (proposal) => setPendingProposal(proposal);

    const onRequest = async (event) => {
      const { topic, request } = event;
      const method = request.method;
      const address = addressRef.current;

      if (READ_ONLY_METHODS.includes(method)) {
        if (!address) {
          await client.respond({ topic, response: { error: { code: 4001, message: 'No wallet address' } } });
          return;
        }
        let result;
        switch (method) {
          case 'eth_accounts':
          case 'eth_getCode':
            result = [address];
            break;
          case 'eth_chainId':
            result = '0x89'; // Polygon mainnet
            break;
          default:
            result = '0x0';
        }
        await client.respond({ topic, response: { result } });
      } else {
        await client.respond({
          topic,
          response: { error: { code: 4001, message: 'SwapPulse wallet is read-only. Transaction signing is not supported.' } },
        });
        toast({ title: 'Request rejected', description: 'Read-only mode — signing is not supported.', variant: 'destructive' });
      }
    };

    const onSessionUpdate = () => setSessions(client.session.keys.map(k => client.session.get(k)));

    client.on('session_proposal', onProposal);
    client.on('session_request', onRequest);
    client.on('session_delete', onSessionUpdate);

    return () => {
      client.off('session_proposal', onProposal);
      client.off('session_request', onRequest);
      client.off('session_delete', onSessionUpdate);
    };
  }, [client, toast]);

  const pair = useCallback(async (uri) => {
    if (!client) return;
    setPairing(true);
    try {
      await client.pair({ uri });
    } catch (e) {
      toast({ title: 'Connection failed', description: e.message, variant: 'destructive' });
    } finally {
      setPairing(false);
    }
  }, [client, toast]);

  const approve = useCallback(async (proposal) => {
    if (!client || !proposal) return;
    const address = addressRef.current;
    if (!address) return;
    try {
      const { id, requiredNamespaces, optionalNamespaces } = proposal.params;
      const allNamespaces = { ...requiredNamespaces, ...optionalNamespaces };
      const namespaces = {};
      for (const [key, ns] of Object.entries(allNamespaces)) {
        namespaces[key] = {
          accounts: (ns.chains || []).map(c => `${c}:${address}`),
          methods: READ_ONLY_METHODS,
          events: ns.events || [],
        };
      }
      await client.approve({ id, namespaces });
      setPendingProposal(null);
      setSessions(client.session.keys.map(k => client.session.get(k)));
      toast({ title: 'Connected!', description: 'dApp connected in read-only mode.' });
    } catch (e) {
      toast({ title: 'Approval failed', description: e.message, variant: 'destructive' });
    }
  }, [client, toast]);

  const reject = useCallback(async (proposal) => {
    if (!client || !proposal) return;
    try {
      await client.reject({ id: proposal.id, reason: { code: 4001, message: 'User rejected' } });
      setPendingProposal(null);
    } catch (e) {
      console.error('WC reject failed:', e);
    }
  }, [client]);

  const disconnect = useCallback(async (topic) => {
    if (!client) return;
    try {
      await client.disconnect({ topic, reason: { code: 4001, message: 'User disconnected' } });
      setSessions(client.session.keys.map(k => client.session.get(k)));
      toast({ title: 'Disconnected' });
    } catch (e) {
      console.error('WC disconnect failed:', e);
    }
  }, [client, toast]);

  return {
    client,
    sessions,
    pairing,
    pendingProposal,
    pair,
    approve,
    reject,
    disconnect,
    isConfigured: !!WALLETCONNECT_PROJECT_ID,
  };
}