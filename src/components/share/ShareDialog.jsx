import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Share2, Copy, Check, MessageCircle, Send, MessagesSquare,
  Globe, Bird, Radio,
} from 'lucide-react';

// Platform brand colors for the icon-button accents
const PLATFORMS = [
  { id: 'whatsapp', labelKey: 'share.whatsapp', icon: MessageCircle, color: 'text-[#25D366]', bg: 'hover:bg-[#25D366]/10' },
  { id: 'signal', labelKey: 'share.signal', icon: Send, color: 'text-[#3A76F0]', bg: 'hover:bg-[#3A76F0]/10' },
  { id: 'discord', labelKey: 'share.discord', icon: MessagesSquare, color: 'text-[#5865F2]', bg: 'hover:bg-[#5865F2]/10' },
  { id: 'mastodon', labelKey: 'share.mastodon', icon: Globe, color: 'text-[#6364FF]', bg: 'hover:bg-[#6364FF]/10' },
  { id: 'bluesky', labelKey: 'share.bluesky', icon: Bird, color: 'text-[#0085FF]', bg: 'hover:bg-[#0085FF]/10' },
  { id: 'nostr', labelKey: 'share.nostr', icon: Radio, color: 'text-[#F40E02]', bg: 'hover:bg-[#F40E02]/10' },
];

function getPageMeta() {
  let title = '';
  let description = '';
  try {
    title = document.title.replace(/,\s*SwapPulse.*$/, '') || 'SwapPulse';
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) description = descEl.getAttribute('content') || '';
  } catch {}
  return { title, description };
}

function buildShareUrl(locale) {
  try {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}?lang=${encodeURIComponent(locale)}`;
  } catch {
    return '';
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export default function ShareDialog({ open, onClose }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [pageMeta, setPageMeta] = useState({ title: '', description: '' });
  const [copied, setCopied] = useState(false);
  const [mastodonInstance, setMastodonInstance] = useState('');
  const [showMastodonInput, setShowMastodonInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    const meta = getPageMeta();
    setPageMeta(meta);
    const url = buildShareUrl(locale);
    setShareUrl(url);
    const prefilled = meta.description
      ? `${meta.description}\n\n${url}`
      : `${meta.title}\n\n${url}`;
    setMessage(prefilled);
    setShowMastodonInput(false);
    setMastodonInstance('');
    setCopied(false);
  }, [open, locale]);

  const fullText = `${message}`.trim();

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: pageMeta.title, text: fullText, url: shareUrl });
      } catch {
        // user cancelled
      }
    } else {
      const ok = await copyToClipboard(fullText);
      toast({ title: ok ? t('share.copied') : t('share.copyFailed') });
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleMastodon = () => {
    if (!showMastodonInput) {
      setShowMastodonInput(true);
      return;
    }
    let instance = mastodonInstance.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!instance) instance = 'mastodon.social';
    const url = `https://${instance}/share?text=${encodeURIComponent(fullText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyFallback = async (platformHome) => {
    const ok = await copyToClipboard(fullText);
    toast({ title: ok ? t('share.copied') : t('share.copyFailed') });
    if (platformHome) window.open(platformHome, '_blank', 'noopener,noreferrer');
  };

  const handlePlatform = (platformId) => {
    switch (platformId) {
      case 'whatsapp': handleWhatsApp(); break;
      case 'mastodon': handleMastodon(); break;
      case 'signal': handleCopyFallback('https://signal.me/'); break;
      case 'discord': handleCopyFallback('https://discord.com/channels/@me'); break;
      case 'bluesky': handleCopyFallback('https://bsky.app/'); break;
      case 'nostr': handleCopyFallback(null); break;
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast({ title: t('share.linkCopied') });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: t('share.copyFailed'), variant: 'destructive' });
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            {t('share.title')}
          </DialogTitle>
          <DialogDescription>{t('share.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pageMeta.title && (
            <p className="text-sm font-semibold text-foreground line-clamp-2">{pageMeta.title}</p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('share.editMessage')}</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none text-sm"
              aria-label={t('share.editMessage')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('share.linkLabel')}</label>
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="text-xs" aria-label={t('share.linkLabel')} />
              <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0" aria-label={t('share.copyLink')}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {hasNativeShare && (
            <Button onClick={handleNativeShare} className="w-full" size="lg">
              <Share2 className="h-4 w-4 mr-2" />
              {t('share.nativeShare')}
            </Button>
          )}

          {showMastodonInput && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('share.mastodonInstance')}</label>
              <Input
                value={mastodonInstance}
                onChange={(e) => setMastodonInstance(e.target.value)}
                placeholder="mastodon.social"
                className="text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isActiveMastodon = p.id === 'mastodon' && showMastodonInput;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePlatform(p.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-xs font-medium transition-colors ${p.bg} hover:border-strong`}
                  aria-label={t(p.labelKey)}
                >
                  <Icon className={`h-6 w-6 ${p.color}`} />
                  <span className={isActiveMastodon ? 'text-primary font-semibold' : ''}>
                    {t(p.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground/70 text-center">{t('share.langNote')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}