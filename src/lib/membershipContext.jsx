import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// MembershipProvider — batch-resolves SwapPulse membership for author DIDs so
// the ExternalIndicator can render synchronously across feed cards, comments,
// and trade rows without per-card profile fetches. Components register DIDs
// via `registerDid`; the provider debounces them into a single
// resolve-membership call per flush. `isExternal(did)` returns true only for
// DIDs that have been resolved AND are not members (so unresolved DIDs show no
// indicator until the batch completes, avoiding false positives for members).

const MembershipContext = createContext({ isExternal: () => false, registerDid: () => {} });

export function MembershipProvider({ children }) {
  const [members, setMembers] = useState(new Set());
  const [resolved, setResolved] = useState(new Set());
  const membersRef = useRef(new Set());
  const resolvedRef = useRef(new Set());
  const inflightRef = useRef(new Set());
  const pendingRef = useRef(new Set());
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    timerRef.current = null;
    const dids = Array.from(pendingRef.current);
    pendingRef.current = new Set();
    if (!dids.length) return;
    dids.forEach((d) => inflightRef.current.add(d));
    base44.functions
      .invoke('resolve-membership', { dids })
      .then((res) => {
        const data = res?.data ?? res;
        (data?.members || []).forEach((d) => membersRef.current.add(d));
        dids.forEach((d) => resolvedRef.current.add(d));
        setMembers(new Set(membersRef.current));
        setResolved(new Set(resolvedRef.current));
      })
      .catch(() => {})
      .finally(() => {
        dids.forEach((d) => inflightRef.current.delete(d));
      });
  }, []);

  const registerDid = useCallback(
    (did) => {
      if (!did) return;
      if (
        membersRef.current.has(did) ||
        resolvedRef.current.has(did) ||
        inflightRef.current.has(did) ||
        pendingRef.current.has(did)
      )
        return;
      pendingRef.current.add(did);
      if (timerRef.current) return;
      timerRef.current = setTimeout(flush, 150);
    },
    [flush],
  );

  const isExternal = useCallback(
    (did) => !!did && resolved.has(did) && !members.has(did),
    [resolved, members],
  );

  return (
    <MembershipContext.Provider value={{ isExternal, registerDid }}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  return useContext(MembershipContext);
}