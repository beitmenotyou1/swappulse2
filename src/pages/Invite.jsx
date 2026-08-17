import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, ArrowRight, Link2, CheckCircle2, Loader2, ShieldCheck, Users, RefreshCw, ScanLine, BookOpen } from 'lucide-react';
import useSEO from '@/hooks/useSEO';

export default function Invite() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | valid | invalid
  useSEO({
    title: 'Join SwapPulse, Pokémon TCG Collector Community',
    description: 'You\'re invited to join SwapPulse, the decentralized social network for Pokémon TCG collectors. Track your collection, trade cards, and connect with the community.',
    canonicalPath: '/invite',
  });

  useEffect(() => {
    if (!code) { setStatus('invalid'); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('validate-invite', { code });
        setStatus(res.data?.valid ? 'valid' : 'invalid');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [code]);

  const registerUrl = code ? `/register?invite=${encodeURIComponent(code)}` : '/register';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            You're invited to SwapPulse
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            The decentralized social network for Pokémon TCG collectors. Track your collection,
            trade cards, and connect with a community that shares your passion, all built on the
            AT Protocol.
          </p>
          {status === 'checking' && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying your invite code…
            </div>
          )}
          {status === 'valid' && (
            <div className="mt-6">
              <button
                onClick={() => navigate(registerUrl)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Create your free account <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                No password needed, just your email. Takes less than a minute.
              </p>
            </div>
          )}
          {status === 'invalid' && (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">This invite link isn't valid</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The code may have already been used or expired. You can still explore SwapPulse
                without an account.
              </p>
              <Link
                to="/"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Explore SwapPulse <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: ScanLine, title: 'AI Card Scanner', desc: 'Scan cards to instantly identify and add them to your collection.' },
            { icon: RefreshCw, title: 'Trade with Trust', desc: 'Trade safely with verified collectors backed by a vouch-based trust graph.' },
            { icon: BookOpen, title: 'Digital Binders', desc: 'Showcase your best pulls in beautiful, customizable digital binders.' },
            { icon: Users, title: 'Community Circles', desc: 'Join circles, meetups, and challenges with collectors who share your interests.' },
            { icon: ShieldCheck, title: 'Your Data, Yours', desc: 'Built on the AT Protocol, your posts federate to Bluesky and beyond.' },
            { icon: Sparkles, title: 'Free & Open Source', desc: 'No paywalls, no ads, no tracking. Funded by voluntary donations.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-sm font-bold">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Migration Guide */}
      <div className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Already on Bluesky? Migrate your account</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              If you already have a Bluesky account, you can link it to SwapPulse after creating
              your account. This lets you use the same identity, brings over your follows, and
              attributes your posts to <em>you</em> across the federated network.
            </p>
            <ol className="mt-4 space-y-3">
              {[
                { step: '1', title: 'Create your SwapPulse account', desc: 'Use the button above to register with your email. It only takes a minute.' },
                { step: '2', title: 'Go to Settings → AT Protocol', desc: 'After logging in, open Settings and find the "Link Your Bluesky Account" section.' },
                { step: '3', title: 'Enter your Bluesky app password', desc: 'Use a Bluesky app password (not your main password) from bsky.app/settings/app-passwords. Enter your Bluesky handle and the app password to link.' },
                { step: '4', title: 'Your follows migrate automatically', desc: 'Once linked, your existing Bluesky follows are imported into SwapPulse so your feed is populated from day one.' },
                { step: '5', title: 'Post as yourself', desc: 'Your posts, replies, likes, and follows now federate from your own Bluesky identity, not the shared bridge account.' },
              ].map((s) => (
                <li key={s.step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-card p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span>
                Your Bluesky account stays fully intact, linking just lets SwapPulse read and write
                to it on your behalf. You can unlink at any time from Settings.
              </span>
            </div>
            {status === 'valid' && (
              <button
                onClick={() => navigate(registerUrl)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © SwapPulse, Built on the AT Protocol · Powered by TCGdex · Free & Open Source
        </p>
      </div>
    </div>
  );
}