import React, { useState, useCallback, useEffect } from 'react';
import { Share2, Copy, Check, X, MessageSquare } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  { id: 'whatsapp', labelKey: 'share.whatsapp', Icon: WhatsAppIcon, color: 'text-[#25D366]', bg: 'hover:bg-[#25D366]/10', hasWebIntent: true },
  { id: 'signal', labelKey: 'share.signal', Icon: SignalIcon, color: 'text-[#3A76F0]', bg: 'hover:bg-[#3A76F0]/10', hasWebIntent: false },
  { id: 'discord', labelKey: 'share.discord', Icon: DiscordIcon, color: 'text-[#5865F2]', bg: 'hover:bg-[#5865F2]/10', hasWebIntent: false },
  { id: 'mastodon', labelKey: 'share.mastodon', Icon: MastodonIcon, color: 'text-[#6364FF]', bg: 'hover:bg-[#6364FF]/10', hasWebIntent: true },
  { id: 'bluesky', labelKey: 'share.bluesky', Icon: BlueskyIcon, color: 'text-[#0EA5E9]', bg: 'hover:bg-[#0EA5E9]/10', hasWebIntent: false },
  { id: 'nostr', labelKey: 'share.nostr', Icon: NostrIcon, color: 'text-[#9333EA]', bg: 'hover:bg-[#9333EA]/10', hasWebIntent: false },
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

  const handleWhatsApp = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [message]);

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

  const handlePlatformWithoutIntent = useCallback(async (platformHome) => {
    // Try native Web Share API first (lets the OS pick the app).
    if (navigator.share) {
      const ok = await handleNativeShare();
      if (ok) return;
    }
    // Fallback: copy message to clipboard, then open the platform.
    const copiedOk = await copyToClipboard(message);
    if (copiedOk) {
      toast({ title: t('share.copied'), description: t('share.pasteHint') });
    }
    if (platformHome) {
      window.open(platformHome, '_blank', 'noopener,noreferrer');
    }
  }, [message, handleNativeShare, copyToClipboard, toast, t]);

  const handlePlatform = useCallback((platformId) => {
    switch (platformId) {
      case 'whatsapp':
        handleWhatsApp();
        break;
      case 'mastodon':
        handleMastodon();
        break;
      case 'signal':
        handlePlatformWithoutIntent('https://signal.org');
        break;
      case 'discord':
        handlePlatformWithoutIntent('https://discord.com');
        break;
      case 'bluesky':
        handlePlatformWithoutIntent('https://bsky.app');
        break;
      case 'nostr':
        handlePlatformWithoutIntent('https://nostr.com');
        break;
    }
  }, [handleWhatsApp, handleMastodon, handlePlatformWithoutIntent]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            {t('share.title')}
          </DialogTitle>
          <DialogDescription>{t('share.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Editable message */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t('share.editMessage')}</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePlatform(p.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 transition-colors ${p.bg}`}
              aria-label={t(p.labelKey)}
            >
              <p.Icon className={`h-6 w-6 ${p.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{t(p.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Native share + copy link */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {typeof navigator !== 'undefined' && navigator.share && (
            <Button onClick={handleNativeButton} variant="outline" className="flex-1 gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('share.nativeShare')}
            </Button>
          )}
          <Button onClick={handleCopyLink} variant="outline" className="flex-1 gap-2">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? t('share.copied') : t('share.copyLink')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}