import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, CreditCard, Bitcoin, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';
import DonationContactForm from '@/components/donate/DonationContactForm';

export default function HelpDonations() {
  useSEO({
    title: 'Donations Help',
    description: 'How to donate to SwapPulse by card or cryptocurrency, accepted currencies, fees, and limitations.',
    canonicalPath: '/help/donations',
  });

  return (
    <div>
      <PageHeader title="Donations" subtitle="How to support SwapPulse" />
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Link to="/help" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Help Centre
        </Link>

        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Why donate?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            SwapPulse is free and open-source. Donations cover hosting, the TCGDex catalogue, and AT Protocol
            infrastructure. Every contribution keeps the platform running for the whole community.
          </p>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Donate by card (fiat)</h2>
          </div>
          <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Go to the <Link to="/donate" className="text-primary hover:underline">donate page</Link> and choose "Card (Fiat)".</li>
            <li>Enter an amount in GBP (£5, £10, £25, £50, £100, or custom) and your email.</li>
            <li>Click Donate. You'll be redirected to Stripe's secure checkout.</li>
            <li>Enter your card details and complete the payment.</li>
            <li>You'll be redirected back to SwapPulse and receive a receipt by email.</li>
          </ol>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Bitcoin className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Donate by cryptocurrency</h2>
          </div>
          <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Go to the <Link to="/donate" className="text-primary hover:underline">donate page</Link> and choose "Cryptocurrency".</li>
            <li>Enter an amount in USD and select a coin (stablecoins, privacy coins, or major coins).</li>
            <li>Click Donate. We'll generate a unique deposit address for your donation.</li>
            <li>Send the exact crypto amount to the deposit address.</li>
            <li>The page checks every 5 seconds and shows a confirmation when the payment is detected.</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Accepted currencies &amp; networks</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            <li><b>Stablecoins:</b> USDC and USDT on Solana, Ethereum, and Polygon.</li>
            <li><b>Privacy coins:</b> Monero (XMR), Zcash (ZEC), Dash (DASH).</li>
            <li><b>Major coins:</b> Bitcoin (BTC), Ethereum (ETH), Solana (SOL), Polygon (MATIC).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Fees</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            <li><b>Card (Stripe):</b> 2.9% + £0.20 per transaction (UK domestic cards). No monthly fees.</li>
            <li><b>Crypto (NowPayments):</b> 0.5% for same-currency, 1% for converted. Network gas fees are separate.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="font-bold">Known limitations</h2>
          </div>
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            <li>Cryptocurrency donations cannot be refunded once sent.</li>
            <li>Minimum donation is £0.50 (card) or $0.50 (crypto).</li>
            <li>Donations are not tax-deductible.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-bold">Contact us</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Have a question about donating? Send us a message and we'll get back to you.
          </p>
          <DonationContactForm />
        </section>
      </div>
    </div>
  );
}