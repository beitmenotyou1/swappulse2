import React, { useCallback, useRef, useState } from 'react';
import BotChallengeModal from '@/components/bot/BotChallengeModal';
import { setBotChallengeAPI, checkBotRiskServer, BotBlockError } from '@/lib/botGuardClient';

// Mounts the bot-protection challenge flow at the app root. Registers an API
// the withBotGuard wrapper calls: ensureAllowed(actionType, content) runs the
// server check, opens the challenge modal when required, retries with the
// token, and resolves when allowed (or throws BotBlockError when blocked).
export default function BotChallengeProvider({ children }) {
  const [modal, setModal] = useState({ open: false, siteKey: '', challengeToken: '' });
  const resolveRef = useRef(null);

  const ensureAllowed = useCallback(async (actionType, content) => {
    const first = await checkBotRiskServer(actionType, content);
    if (first.block) throw new BotBlockError(actionType, first.reasons);
    if (first.allow) return true;

    // Challenge required — open the modal and wait for a token.
    const token = await new Promise((resolve, reject) => {
      resolveRef.current = { resolve, reject };
      setModal({ open: true, siteKey: first.captchaSiteKey || '', challengeToken: first.challengeToken || '' });
    });

    // Retry the check with the token.
    const second = await checkBotRiskServer(actionType, content, token);
    if (second.allow) return true;
    throw new BotBlockError(actionType, second.reasons || ['challenge_failed']);
  }, []);

  const handleResolved = useCallback((token) => {
    setModal((m) => ({ ...m, open: false }));
    if (resolveRef.current) resolveRef.current.resolve(token);
  }, []);

  const handleCancel = useCallback(() => {
    setModal((m) => ({ ...m, open: false }));
    if (resolveRef.current) resolveRef.current.reject(new BotBlockError('challenge', ['cancelled']));
  }, []);

  React.useEffect(() => {
    setBotChallengeAPI({ ensureAllowed });
    return () => setBotChallengeAPI(null);
  }, [ensureAllowed]);

  return (
    <>
      {children}
      <BotChallengeModal
        open={modal.open}
        siteKey={modal.siteKey}
        challengeToken={modal.challengeToken}
        onResolved={handleResolved}
        onCancel={handleCancel}
      />
    </>
  );
}