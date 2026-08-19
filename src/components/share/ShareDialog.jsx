import React, { useState, useCallback, useEffect } from 'react';
import { Share2, Check, X, MessageSquare, Link2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { WhatsAppIcon, SignalIcon, DiscordIcon, MastodonIcon, BlueskyIcon, NostrIcon } from './PlatformIcons';

// Build a language-tagged share URL for the current page.
function buildShareUrl(locale) {
  const { origin, pathname } = window.location;
  const url = new URL(origin + pathname);
  url.searchParams.set('lang', locale);
  return url.toString();
}

// Read the page's SEO title + description from the document head.
function getSeoMeta() {
  const title = document.title || '';
  const descMeta = document.querySelector('meta[name="description"]');
  const description = descMeta?.getAttribute('content') || '';
  return { title: title.replace(/, SwapPulse$/, ''), description };
}

const PLATFORMS = [
  { id: 'whatsapp', labelKey: 'share.whatsapp', Icon: WhatsAppIcon, color: '#25D366',
    shareUrl: (msg) => `https://wa.me/?text=${encodeURIComponent(msg)}` },
  { id: 'signal', labelKey: 'share.signal', Icon: SignalIcon, color: '#3A76F0',
    homeUrl: 'https://signal.org' },
  { id: 'discord', labelKey: 'share.discord', Icon: DiscordIcon, color: '#5865F2',
    homeUrl: 'https://discord.com' },
  { id: 'mastodon', labelKey: 'share.mastodon', Icon: MastodonIcon, color: '#6364FF',
    needsInstance: true },
  { id: 'bluesky', labelKey: 'share.bluesky', Icon: BlueskyIcon, color: '#0EA5E9',
    shareUrl: (msg) => `https://bsky.app/intent/compose?text=${encodeURIComponent(msg)}` },
  { id: 'nostr', labelKey: 'share.nostr', Icon: NostrIcon, color: '#9333EA',
    homeUrl: 'https://nostr.com' },
];

export default function ShareDialog({ open, onOpenChange }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [mastodonInstance, setMastodonInstance] = useState('');
  const [showMastodonInput, setShowMastodonInput] = useState(false);

  // Initialise the message when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const { description } = getSeoMeta();
    const url = buildShareUrl(locale);
    const prefilled = description ? `${description}\n\n${url}` : url;
    setMessage(prefilled);
    setCopied(false);
    setShowMastodonInput(false);
    setMastodonInstance('');
  }, [open, locale]);

  const shareUrl = buildShareUrl(locale);

  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message, url: shareUrl });
        return true;
      } catch {
        return false; // user cancelled
      }
    }
    return false;
  }, [message, shareUrl]);

  const handleMastodon = useCallback(() => {
    if (!showMastodonInput) {
      setShowMastodonInput(true);
      return;
    }
    const instance = mastodonInstance.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!instance) return;
    const url = `https://${instance}/share?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [message, mastodonInstance, showMastodonInput]);

  const handlePlatform = useCallback(async (platform) => {
    // Mastodon needs the user's instance URL.
    if (platform.needsInstance) {
      handleMastodon();
      return;
    }
    // Platforms with official share intent URLs (WhatsApp, Bluesky).
    if (platform.shareUrl) {
      window.open(platform.shareUrl(message), '_blank', 'noopener,noreferrer');
      return;
    }
    // Platforms without web intents (Signal, Discord, Nostr):
    // try native Web Share API, then fall back to copy + open.
    if (navigator.share) {
      const ok = await handleNativeShare();
      if (ok) return;
    }
    const copiedOk = await copyToClipboard(message);
    if (copiedOk) {
      toast({ title: t('share.copied'), description: t('share.pasteHint') });
    }
    if (platform.homeUrl) {
      window.open(platform.homeUrl, '_blank', 'noopener,noreferrer');
    }
  }, [message, handleMastodon, handleNativeShare, copyToClipboard, toast, t]);

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast({ title: t('share.linkCopied') });
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl, copyToClipboard, toast, t]);

  const handleNativeButton = useCallback(async () => {
    const ok = await handleNativeShare();
    if (!ok && !navigator.share) {
      // No native share — copy full message instead.
      const copiedOk = await copyToClipboard(message);
      if (copiedOk) toast({ title: t('share.copied') });
    }
  }, [handleNativeShare, copyToClipboard, message, toast, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            {t('share.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 p-5">
          {/* Editable message */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{t('share.editMessage')}</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              placeholder={t('share.editMessage')}
            />
          </div>

          {/* Mastodon instance input (conditional) */}
          {showMastodonInput && (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={mastodonInstance}
                onChange={(e) => setMastodonInstance(e.target.value)}
                placeholder="mastodon.social"
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleMastodon()}
                autoFocus
              />
              <Button size="sm" onClick={handleMastodon} className="shrink-0">
                {t('share.share')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowMastodonInput(false)} className="shrink-0 px-2">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Platform buttons grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePlatform(p)}
                className="group flex flex-col items-center gap-2"
                aria-label={t(p.labelKey)}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card transition-all duration-200 group-hover:scale-105 group-hover:shadow-raised"
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${p.color}1a`; e.currentTarget.style.borderColor = `${p.color}55`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.borderColor = ''; }}
                >
                  <p.Icon className="h-6 w-6" style={{ color: p.color }} />
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">{t(p.labelKey)}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Copy link + native share */}
          <div className="flex flex-col gap-2 sm:flex-row">
            {typeof navigator !== 'undefined' && navigator.share && (
              <Button onClick={handleNativeButton} variant="outline" className="flex-1 gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('share.nativeShare')}
              </Button>
            )}
            <Button
              onClick={handleCopyLink}
              variant={copied ? 'default' : 'outline'}
              className="flex-1 gap-2"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
              {copied ? t('share.copied') : t('share.copyLink')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}