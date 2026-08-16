import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const LAST_UPDATED = '16 August 2026';

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'service', title: '2. Description of Service' },
  { id: 'accounts', title: '3. Account Registration & Responsibilities' },
  { id: 'federation', title: '4. AT Protocol Federation & Data Portability' },
  { id: 'trading', title: '5. Peer-to-Peer Trading' },
  { id: 'disputes', title: '6. Trade Disputes & Resolution' },
  { id: 'content', title: '7. User-Generated Content & Licensing' },
  { id: 'conduct', title: '8. Acceptable Use & Community Guidelines' },
  { id: 'moderation', title: '9. Moderation & Enforcement' },
  { id: 'ip', title: '10. Intellectual Property' },
  { id: 'disclaimer', title: '11. Disclaimers' },
  { id: 'liability', title: '12. Limitation of Liability' },
  { id: 'indemnity', title: '13. Indemnity' },
  { id: 'termination', title: '14. Account Termination' },
  { id: 'changes', title: '15. Changes to These Terms' },
  { id: 'governing-law', title: '16. Governing Law' },
  { id: 'contact', title: '17. Contact' },
];

export default function Terms() {
  return (
    <>
      <PageHeader title="Terms of Service" subtitle={`Last updated: ${LAST_UPDATED}`} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex gap-8">
          {/* Table of contents — sticky on desktop */}
          <nav className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-20">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</p>
              <ul className="space-y-1.5">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Main content */}
          <article className="prose prose-sm max-w-2xl flex-1 dark:prose-invert">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Scroll to read all sections</span>
            </div>

            <p className="text-sm text-muted-foreground">
              These Terms of Service ("Terms") govern your access to and use of SwapPulse, a decentralized social
              platform for Pokémon TCG collectors. By creating an account or using any part of the service, you agree
              to be bound by these Terms. If you do not agree, do not use SwapPulse.
            </p>

            <h2 id="acceptance" className="mt-8 scroll-mt-20 text-xl font-bold">1. Acceptance of Terms</h2>
            <p>
              By registering an account, posting content, listing trades, or otherwise using SwapPulse, you confirm
              that you have read, understood, and agree to these Terms and our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If you are under 16,
              you must obtain a parent or guardian's consent before using the platform.
            </p>

            <h2 id="service" className="mt-8 scroll-mt-20 text-xl font-bold">2. Description of Service</h2>
            <p>
              SwapPulse is a free, open-source social platform that enables Pokémon TCG collectors to manage digital
              collections, trade cards with other collectors, participate in community challenges, and share content.
              The platform is built on the AT Protocol, meaning your data is stored on a federated Personal Data
              Server (PDS) and is portable across compatible applications. SwapPulse is provided "as is" without
              charge, funded entirely by voluntary donations.
            </p>

            <h2 id="accounts" className="mt-8 scroll-mt-20 text-xl font-bold">3. Account Registration & Responsibilities</h2>
            <p>
              You must provide a valid email address to register. You are responsible for maintaining the security of
              your account and for all activity that occurs under your account. You agree to:
            </p>
            <ul>
              <li>Provide accurate and truthful information when setting up your profile.</li>
              <li>Be at least 13 years old (users under 16 require parental or guardian consent).</li>
              <li>Not create accounts on behalf of others without their permission.</li>
              <li>Notify us promptly of any unauthorized use of your account.</li>
              <li>Use a single account; duplicate or spam accounts may be removed.</li>
            </ul>

            <h2 id="federation" className="mt-8 scroll-mt-20 text-xl font-bold">4. AT Protocol Federation & Data Portability</h2>
            <p>
              SwapPulse is built on the AT Protocol, a decentralized social protocol. When you create an account, a
              unique Decentralized Identifier (DID) and a Personal Data Server (PDS) record are provisioned for you.
              Your posts, trades, collection entries, and social interactions are mirrored to your PDS as public
              records that can be read by other AT Protocol applications, including Bluesky.
            </p>
            <p>
              <strong>This means:</strong>
            </p>
            <ul>
              <li>Your content is stored on a federated server and is publicly readable across the AT Protocol network.</li>
              <li>You can export your data at any time and migrate it to another PDS or compatible application.</li>
              <li>Deleting content on SwapPulse does not guarantee removal from all federated caches or third-party archives.</li>
              <li>Your AT Protocol identity (DID and handle) is yours and portable — you are not locked into SwapPulse.</li>
            </ul>

            <h2 id="trading" className="mt-8 scroll-mt-20 text-xl font-bold">5. Peer-to-Peer Trading</h2>
            <p>
              SwapPulse facilitates peer-to-peer trading of physical Pokémon TCG cards between collectors. SwapPulse is
              a <strong>facilitator only</strong> — we do not act as a party to any trade, hold funds, or guarantee
              the condition, authenticity, or delivery of any card.
            </p>
            <p>You acknowledge that:</p>
            <ul>
              <li>All trades are agreements between you and the other collector. SwapPulse is not a broker or escrow service.</li>
              <li>You are solely responsible for verifying the identity, reputation, and trustworthiness of any trading partner.</li>
              <li>Card conditions (mint, near mint, etc.) are self-reported by the listing owner and should be independently verified.</li>
              <li>You are responsible for complying with all applicable laws regarding the shipping and sale of goods in your jurisdiction.</li>
              <li>SwapPulse's trust and vouching system is a community signal, not a guarantee of trustworthiness.</li>
            </ul>

            <h2 id="disputes" className="mt-8 scroll-mt-20 text-xl font-bold">6. Trade Disputes & Resolution</h2>
            <p>
              If you experience an issue with a trade (misgraded card, wrong card, damage, non-delivery, or suspected
              fraud), you may file a dispute through the platform. Our moderators will review disputes and may take
              actions including warnings, reputation adjustments, or account suspension.
            </p>
            <p>
              SwapPulse does not provide financial compensation for failed trades. You are encouraged to use tracked
              shipping, retain proof of postage, and communicate clearly with your trading partner. For high-value
              trades, consider using third-party escrow or grading services at your own expense.
            </p>

            <h2 id="content" className="mt-8 scroll-mt-20 text-xl font-bold">7. User-Generated Content & Licensing</h2>
            <p>
              You retain ownership of all content you post to SwapPulse, including posts, comments, card scans, journal
              entries, binder displays, and reviews. By posting content, you grant SwapPulse and the AT Protocol
              network a worldwide, non-exclusive, royalty-free license to store, display, reproduce, and distribute
              your content for the purpose of operating the service and federating it across the network.
            </p>
            <p>You represent and warrant that:</p>
            <ul>
              <li>You own or have the rights to all content you post.</li>
              <li>Your content does not infringe any third-party intellectual property, privacy, or other rights.</li>
              <li>You have consent from any individuals depicted in photos you upload.</li>
            </ul>
            <p>
              Card scans and images sourced from TCGDex or other catalog providers are used under their respective
              licenses and remain the property of their copyright holders.
            </p>

            <h2 id="conduct" className="mt-8 scroll-mt-20 text-xl font-bold">8. Acceptable Use & Community Guidelines</h2>
            <p>You agree not to use SwapPulse to:</p>
            <ul>
              <li>Harass, threaten, or defame other collectors.</li>
              <li>Post content that is illegal, hateful, sexually explicit, or promotes violence.</li>
              <li>Engage in fraud, scams, or deceptive trading practices.</li>
              <li>Spam, mass-follow, or artificially inflate reputation or engagement metrics.</li>
              <li>Impersonate another person or entity.</li>
              <li>Distribute malware or attempt to compromise the platform's security.</li>
              <li>Scrape or harvest data in a way that violates the AT Protocol's terms or places undue load on the network.</li>
              <li>Post content that infringes on Nintendo, Game Freak, The Pokémon Company, or other third-party intellectual property beyond fair use.</li>
            </ul>

            <h2 id="moderation" className="mt-8 scroll-mt-20 text-xl font-bold">9. Moderation & Enforcement</h2>
            <p>
              SwapPulse uses a combination of automated AI moderation and human moderators to enforce these Terms.
              We may remove content, issue warnings, shadow-ban, or suspend accounts that violate these Terms.
              Repeated or severe violations may result in permanent termination. You may appeal moderation decisions
              through the platform's feedback mechanism.
            </p>

            <h2 id="ip" className="mt-8 scroll-mt-20 text-xl font-bold">10. Intellectual Property</h2>
            <p>
              The SwapPulse name, logo, software, and design are owned by SwapPulse and licensed under AGPL-3.0.
              Pokémon, Pokémon TCG, and all related characters and imagery are trademarks of Nintendo, Game Freak,
              and The Pokémon Company International. SwapPulse is not affiliated with, endorsed by, or sponsored by
              these entities. Card data is sourced from TCGDex under its open data license.
            </p>

            <h2 id="disclaimer" className="mt-8 scroll-mt-20 text-xl font-bold">11. Disclaimers</h2>
            <p>
              SwapPulse is provided "as is" and "as available" without warranties of any kind, express or implied.
              We do not guarantee that the service will be uninterrupted, secure, or error-free. Card pricing data is
              sourced from third parties and may be inaccurate or outdated. Reputation scores, trust vouches, and
              community signals are subjective and should not be relied upon as guarantees.
            </p>

            <h2 id="liability" className="mt-8 scroll-mt-20 text-xl font-bold">12. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, SwapPulse and its contributors shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
              arising from your use of the platform. This includes, without limitation, losses arising from failed
              trades, lost cards, fraudulent transactions, or reliance on reputation or pricing data. Our total
              liability for any claim shall not exceed any amount you have donated to SwapPulse in the 12 months
              preceding the claim.
            </p>

            <h2 id="indemnity" className="mt-8 scroll-mt-20 text-xl font-bold">13. Indemnity</h2>
            <p>
              You agree to indemnify and hold harmless SwapPulse and its contributors from any claims, damages, or
              expenses (including legal fees) arising from your content, your use of the platform, your trading
              activity, or your violation of these Terms.
            </p>

            <h2 id="termination" className="mt-8 scroll-mt-20 text-xl font-bold">14. Account Termination</h2>
            <p>
              You may delete your account at any time through the Settings page. Account deletion removes your
              SwapPulse-side data; however, content already federated to the AT Protocol network may persist in
              third-party caches. We may suspend or terminate your account if you violate these Terms or if we
              determine that your activity poses a risk to the community.
            </p>

            <h2 id="changes" className="mt-8 scroll-mt-20 text-xl font-bold">15. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be announced through the platform.
              Your continued use of SwapPulse after changes take effect constitutes acceptance of the revised Terms.
              The "Last updated" date at the top of this page reflects the most recent revision.
            </p>

            <h2 id="governing-law" className="mt-8 scroll-mt-20 text-xl font-bold">16. Governing Law</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the
              exclusive jurisdiction of the courts of England and Wales, except that you may bring a claim in your
              local consumer protection court if you are a consumer in the European Union or United Kingdom.
            </p>

            <h2 id="contact" className="mt-8 scroll-mt-20 text-xl font-bold">17. Contact</h2>
            <p>
              Questions about these Terms can be submitted through the platform's{' '}
              <Link to="/help" className="text-primary hover:underline">Help</Link> page or feedback mechanism.
              SwapPulse is an open-source project; the source code is available for review and self-hosting.
            </p>

            <div className="mt-10 border-t border-border pt-6">
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to SwapPulse
              </Link>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}