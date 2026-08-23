import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, ArrowRight, Link2, CheckCircle2, Loader2, ShieldCheck, Users, RefreshCw, ScanLine, BookOpen, UserPlus } from 'lucide-react';
import Avatar from '@/components/Avatar';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

const FEATURES = [
  { icon: ScanLine, titleKey: 'page.invite.feature.scanner.title', descKey: 'page.invite.feature.scanner.desc' },
  { icon: RefreshCw, titleKey: 'page.invite.feature.trust.title', descKey: 'page.invite.feature.trust.desc' },
  { icon: BookOpen, titleKey: 'page.invite.feature.binders.title', descKey: 'page.invite.feature.binders.desc' },
  { icon: Users, titleKey: 'page.invite.feature.circles.title', descKey: 'page.invite.feature.circles.desc' },
  { icon: ShieldCheck, titleKey: 'page.invite.feature.data.title', descKey: 'page.invite.feature.data.desc' },
  { icon: Sparkles, titleKey: 'page.invite.feature.free.title', descKey: 'page.invite.feature.free.desc' },
];

const STEPS = [
  { step: '1', titleKey: 'page.invite.step1.title', descKey: 'page.invite.step1.desc' },
  { step: '2', titleKey: 'page.invite.step2.title', descKey: 'page.invite.step2.desc' },
  { step: '3', titleKey: 'page.invite.step3.title', descKey: 'page.invite.step3.desc' },
  { step: '4', titleKey: 'page.invite.step4.title', descKey: 'page.invite.step4.desc' },
  { step: '5', titleKey: 'page.invite.step5.title', descKey: 'page.invite.step5.desc' },
];

export default function Invite() {
  const t = useT();
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');
  const [inviter, setInviter] = useState(null);
  const [connecting, setConnecting] = useState(false);
  useSEO({
    title: 'Join SwapPulse, Pokémon TCG Collector Community',
    description: "You're invited to join SwapPulse, the decentralized social network for Pokémon TCG collectors. Track your collection, trade cards, and connect with the community.",
    canonicalPath: '/invite',
  });

  useEffect(() => {
    if (!code) { setStatus('invalid'); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('validate-invite', { code });
        const valid = res.data?.valid;
        const inv = res.data?.inviter || null;
        setInviter(inv);
        if (!valid) { setStatus('invalid'); return; }

        // If the visitor is already a member, silently auto-connect and redirect
        // to the inviter's profile instead of showing the registration CTA.
        const authed = await base44.auth.isAuthenticated().catch(() => false);
        if (authed && inv?.did) {
          setStatus('connecting');
          setConnecting(true);
          try {
            const conn = await base44.functions.invoke('connect-invite', { code });
            const cdata = conn.data || conn;
            if (cdata?.connected) {
              const target = inv.handle ? `/u/${inv.handle}` : `/profile/${inv.did}`;
              navigate(target, { replace: true });
              return;
            }
          } catch {
            // fall through to the registration CTA if connect fails
          }
          setConnecting(false);
        }
        setStatus('valid');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [code]);

  const registerUrl = code ? `/register?invite=${encodeURIComponent(code)}` : '/register';

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('page.invite.title')}</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{t('page.invite.subtitle')}</p>
          {status === 'valid' && inviter && (
            <div className="mx-auto mt-5 flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <Avatar name={inviter.name || inviter.handle} src={inviter.avatar} size={48} />
              <div className="min-w-0 text-left">
                <p className="text-xs text-muted-foreground">Invited by</p>
                <p className="truncate text-sm font-bold">{inviter.name || inviter.handle || 'A SwapPulse collector'}</p>
                {inviter.handle && <p className="truncate text-xs text-muted-foreground">@{inviter.handle}</p>}
              </div>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                <UserPlus className="h-3 w-3" /> Auto-follow
              </span>
            </div>
          )}
          {status === 'checking' && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('page.invite.verifying')}
            </div>
          )}
          {status === 'connecting' && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting you to {inviter?.name || inviter?.handle || 'your inviter'}…
            </div>
          )}
          {status === 'valid' && (
            <div className="mt-6">
              <button
                onClick={() => navigate(registerUrl)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t('page.invite.createAccount')} <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-2 text-xs text-muted-foreground">{t('page.invite.noPassword')}</p>
            </div>
          )}
          {status === 'invalid' && (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">{t('page.invite.invalidTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('page.invite.invalidDesc')}</p>
              <Link
                to="/"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                {t('page.invite.explore')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.titleKey} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-sm font-bold">{t(f.titleKey)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{t('page.invite.migrateTitle')}</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('page.invite.migrateDesc')}</p>
            <ol className="mt-4 space-y-3">
              {STEPS.map((s) => (
                <li key={s.step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t(s.titleKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(s.descKey)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-card p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span>{t('page.invite.migrateNote')}</span>
            </div>
            {status === 'valid' && (
              <button
                onClick={() => navigate(registerUrl)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t('page.invite.getStarted')} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">{t('page.invite.footer')}</p>
      </div>
    </div>
  );
}