import React, { useEffect, useState } from 'react';
import { Download as DownloadIcon, Smartphone, Globe, Shield, ChevronRight, Apple } from 'lucide-react';
import QRCode from 'qrcode';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';

export default function DownloadPage() {
  useSEO({
    title: 'Download SwapPulse',
    description: 'Get SwapPulse on your device — Android via Google Play, F-Droid, or direct APK. iOS users install the PWA.',
    canonicalPath: '/download',
  });

  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(window.location.href, { width: 200, margin: 1 })
      .then(setQrUrl)
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Download SwapPulse" subtitle="Get the app on your device" />
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Smartphone className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-extrabold">SwapPulse everywhere</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trade cards, track collections, and connect with collectors on any device.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Smartphone className="h-4 w-4 text-primary" /> Android
          </h3>

          <a
            href="https://play.google.com/store"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Globe className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold">Google Play Store</p>
                <p className="text-xs text-muted-foreground">Install from the Play Store</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </a>

          <a
            href="https://f-droid.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold">F-Droid</p>
                <p className="text-xs text-muted-foreground">Open-source Android repository</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </a>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <DownloadIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">Direct APK Download</p>
                <p className="text-xs text-muted-foreground">Install without an app store</p>
              </div>
            </div>
            {qrUrl && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <img src={qrUrl} alt="QR code for download page" className="h-32 w-32 rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground">Scan with your phone to open this page</p>
              </div>
            )}
            <a
              href="/download/swappulse.apk"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
            >
              <DownloadIcon className="h-4 w-4" /> Download APK
            </a>
            <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Install instructions:</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Download the APK file</li>
                <li>Open it on your Android device</li>
                <li>Allow installs from unknown sources if prompted</li>
                <li>Follow the on-screen setup</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Apple className="h-4 w-4 text-primary" /> iOS (PWA)
          </h3>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              SwapPulse is a Progressive Web App — no App Store needed. Web push notifications work on iOS 16.4+ when
              installed to your home screen.
            </p>
            <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Install on iOS:</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Open swappulse.org in Safari</li>
                <li>Tap the Share button</li>
                <li>Select "Add to Home Screen"</li>
                <li>Launch from your home screen</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}