import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

const LAST_UPDATED = '17 August 2026';

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'service', title: '2. Description of Service' },
  { id: 'accounts', title: '3. Account Registration & Responsibilities' },
  { id: 'federation', title: '4. AT Protocol Federation & Data Portability' },
  { id: 'trading', title: '5. Peer-to-Peer Trading & Trade Chains' },
  { id: 'disputes', title: '6. Trade Disputes & Resolution' },
  { id: 'e2ee', title: '7. End-to-End Encrypted Messaging' },
  { id: 'voice-podcasts', title: '8. Voice Spaces & Podcasts' },
  { id: 'ai', title: '9. AI Features (Scanner & Assistants)' },
  { id: 'stories', title: '10. Stories & Ephemeral Content' },
  { id: 'content', title: '11. User-Generated Content & Licensing' },
  { id: 'conduct', title: '12. Acceptable Use & Community Guidelines' },
  { id: 'moderation', title: '13. Moderation, Bot Protection & Enforcement' },
  { id: 'donations', title: '14. Donations & Payments' },
  { id: 'ip', title: '15. Intellectual Property' },
  { id: 'disclaimer', title: '16. Disclaimers' },
  { id: 'liability', title: '17. Limitation of Liability' },
  { id: 'indemnity', title: '18. Indemnity' },
  { id: 'termination', title: '19. Account Termination' },
  { id: 'changes', title: '20. Changes to These Terms' },
  { id: 'governing-law', title: '21. Governing Law' },
  { id: 'contact', title: '22. Contact' },
];

export default function Terms() {
  const t = useT();
  useSEO({
    title: 'Terms of Service',
    description: 'SwapPulse Terms of Service, account responsibilities, trading, federation, privacy, and community guidelines.',
    canonicalPath: '/terms',
  });
  return (
    <>
      <PageHeader title={t('page.terms.title')} subtitle={`Last updated: ${LAST_UPDATED}`} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex gap-8">
          {/* Table of contents, sticky on desktop */}
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
              By registering an account, posting content, listing trades, sending direct messages, hosting voice
              spaces, or otherwise using SwapPulse, you confirm that you have read, understood, and agree to these
              Terms and our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. If you are under 16,
              you must obtain a parent or guardian's consent before using the platform.
            </p>

            <h2 id="service" className="mt-8 scroll-mt-20 text-xl font-bold">2. Description of Service</h2>
            <p>
              SwapPulse is a free, open-source social platform that enables Pokémon TCG collectors to manage digital
              collections, trade cards with other collectors, participate in community challenges, share content, and
              connect with the broader community. The platform is built on the AT Protocol, meaning your data is
              stored on a federated Personal Data Server (PDS) and is portable across compatible applications.
              SwapPulse is provided "as is" without charge, funded entirely by voluntary donations.
            </p>
            <p>SwapPulse includes the following feature areas:</p>
            <ul>
              <li><strong>Collection management</strong>, track cards, portfolio value, set completion, duplicates, and insurance exports.</li>
              <li><strong>Peer-to-peer trading</strong>, trade listings, threaded negotiations, trade chains, fairness scoring, and disputes.</li>
              <li><strong>Social features</strong>, posts, comments, reactions, reposts, follows, journals, binders, card reviews, and stories.</li>
              <li><strong>Direct messages</strong>, end-to-end encrypted 1:1 conversations.</li>
              <li><strong>Voice spaces & podcasts</strong>, live audio spaces (external stream or in-platform WebRTC), recordings, and podcast distribution via RSS.</li>
              <li><strong>AI tools</strong>, card scanner, trade assistant, market watch assistant, collection advisor, and other AI assistants.</li>
              <li><strong>Community</strong>, circles, meetups, challenges, achievements, pack parties, pull of the week, and predictions.</li>
              <li><strong>Market data</strong>, card price tracking, price alerts, and market watch.</li>
              <li><strong>Trust & reputation</strong>, vouches, trading feedback, and trusted-trader status.</li>
            </ul>

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
              <li>Safeguard your E2EE private key, clearing your browser data will permanently remove your access to encrypted direct messages (see Section 7).</li>
            </ul>

            <h2 id="federation" className="mt-8 scroll-mt-20 text-xl font-bold">4. AT Protocol Federation & Data Portability</h2>
            <p>
              SwapPulse is built on the AT Protocol, a decentralized social protocol. When you create an account, a
              unique Decentralized Identifier (DID) and a Personal Data Server (PDS) record are provisioned for you.
              Your posts, trades, collection entries, voice spaces, podcast episodes, and social interactions are
              mirrored to your PDS as public records that can be read by other AT Protocol applications, including
              Bluesky.
            </p>
            <p>
              <strong>This means:</strong>
            </p>
            <ul>
              <li>Your content is stored on a federated server and is publicly readable across the AT Protocol network.</li>
              <li>You can export your data at any time and migrate it to another PDS or compatible application.</li>
              <li>Deleting content on SwapPulse does not guarantee removal from all federated caches or third-party archives.</li>
              <li>Your AT Protocol identity (DID and handle) is yours and portable, you are not locked into SwapPulse.</li>
              <li>Direct message bodies are end-to-end encrypted before mirroring; only ciphertext is federated.</li>
              <li>Posts with attached cards include an app.bsky.embed.external embed (card page URL, image, localized name) so the card renders on Bluesky and deep-links back to SwapPulse.</li>
            </ul>

            <h2 id="trading" className="mt-8 scroll-mt-20 text-xl font-bold">5. Peer-to-Peer Trading & Trade Chains</h2>
            <p>
              SwapPulse facilitates peer-to-peer trading of physical Pokémon TCG cards between collectors, including
              multi-party trade chains (3–5 participants shipping cards in sequence). SwapPulse is a{' '}
              <strong>facilitator only</strong>, we do not act as a party to any trade, hold funds, or guarantee
              the condition, authenticity, or delivery of any card.
            </p>
            <p>You acknowledge that:</p>
            <ul>
              <li>All trades and trade chains are agreements between you and the other collector(s). SwapPulse is not a broker or escrow service.</li>
              <li>You are solely responsible for verifying the identity, reputation, and trustworthiness of any trading partner.</li>
              <li>Card conditions (mint, near mint, etc.) are self-reported by the listing owner and should be independently verified.</li>
              <li>You are responsible for complying with all applicable laws regarding the shipping and sale of goods in your jurisdiction.</li>
              <li>SwapPulse's trust and vouching system is a community signal, not a guarantee of trustworthiness.</li>
              <li>For trade chains, each participant is responsible for shipping to the next participant promptly; failure to do so may result in reputation penalties and account action.</li>
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

            <h2 id="e2ee" className="mt-8 scroll-mt-20 text-xl font-bold">7. End-to-End Encrypted Messaging</h2>
            <p>
              SwapPulse offers end-to-end encrypted (E2EE) direct messages. Your private encryption key is generated
              in and stored only in your browser; SwapPulse cannot read, decrypt, or recover your encrypted messages.
            </p>
            <p>You acknowledge and agree that:</p>
            <ul>
              <li><strong>No backdoor exists.</strong> SwapPulse cannot decrypt your messages under any circumstances, including legal process.</li>
              <li><strong>Loss of access:</strong> If you clear your browser data, lose your device, or switch browsers, you will lose access to your encrypted message history on that device. SwapPulse is not liable for any inability to decrypt or recover encrypted messages.</li>
              <li><strong>Cross-device sync is not currently supported.</strong> Your encrypted message history is tied to the browser where your private key lives.</li>
              <li>You are responsible for the content of your messages and for complying with all applicable laws when using direct messages.</li>
              <li>SwapPulse reserves the right to act on metadata (who you message and when) and on reports of abuse, but cannot access message content.</li>
            </ul>

            <h2 id="voice-podcasts" className="mt-8 scroll-mt-20 text-xl font-bold">8. Voice Spaces & Podcasts</h2>
            <p>
              SwapPulse voice spaces operate in two modes: <strong>external</strong> (you declare a stream URL on an
              external platform) and <strong>in-platform</strong> (a WebRTC peer mesh for real-time audio). By
              participating in or hosting an in-platform voice space, you agree that:
            </p>
            <ul>
              <li>Your audio may be transmitted peer-to-peer to other participants in the space.</li>
              <li>The host may <strong>record</strong> the stage audio at any time; a visible REC indicator appears while recording is active. By joining a recording-enabled space, you consent to being recorded.</li>
              <li>Recordings may be published as podcast episodes and distributed via a public RSS feed to external podcast apps.</li>
              <li>By publishing a podcast episode, you grant SwapPulse and the AT Protocol network a licence to host, distribute, and make the audio publicly playable (see Section 11).</li>
              <li>You are responsible for ensuring you have the rights to any audio you broadcast and record.</li>
            </ul>

            <h2 id="ai" className="mt-8 scroll-mt-20 text-xl font-bold">9. AI Features (Scanner & Assistants)</h2>
            <p>
              SwapPulse provides AI-powered features including the card scanner and several AI assistants (Trade
              Assistant, Market Watch Assistant, Collection Advisor, Sentiment Conversationalist, Achievement Goal
              Tracker, and Networking Concierge).
            </p>
            <p>
              <strong>Scanner corrections:</strong> When you submit a correction to a scan result, you grant SwapPulse a
              licence to use that correction, including the card photo and your correction, to evaluate and improve
              the scanner model's accuracy. Corrections are processed in anonymized form where possible.
            </p>
            <p>
              <strong>AI assistants:</strong> Outputs from AI assistants (trade suggestions, market analysis,
              collection recommendations) are <strong>suggestions, not professional advice</strong>. SwapPulse does
              not guarantee the accuracy, completeness, or profitability of any AI-generated suggestion. You are
              responsible for your own trading and collection decisions and should not rely solely on AI output. Card
              pricing data referenced by assistants is sourced from third parties and may be inaccurate or outdated.
            </p>

            <h2 id="stories" className="mt-8 scroll-mt-20 text-xl font-bold">10. Stories & Ephemeral Content</h2>
            <p>
              Stories are ephemeral posts that expire after 24 hours. By posting a story, you acknowledge that:
            </p>
            <ul>
              <li>The story record is mirrored to your PDS and may persist in federated caches even after the 24-hour expiry.</li>
              <li>SwapPulse does not guarantee that a story will be fully removed from all federated caches before or after expiry.</li>
              <li>View data (who has seen your story) is collected to drive the seen/unseen ring state and is visible to you as the story author.</li>
              <li>You are responsible for the content of your stories and must have the rights to any media you upload.</li>
            </ul>

            <h2 id="content" className="mt-8 scroll-mt-20 text-xl font-bold">11. User-Generated Content & Licensing</h2>
            <p>
              You retain ownership of all content you post to SwapPulse, including posts, comments, card scans, journal
              entries, binder displays, reviews, stories, voice space recordings, and podcast episodes. By posting
              content, you grant SwapPulse and the AT Protocol network a worldwide, non-exclusive, royalty-free
              licence to store, display, reproduce, and distribute your content for the purpose of operating the
              service and federating it across the network.
            </p>
            <p>You represent and warrant that:</p>
            <ul>
              <li>You own or have the rights to all content you post.</li>
              <li>Your content does not infringe any third-party intellectual property, privacy, or other rights.</li>
              <li>You have consent from any individuals depicted in photos you upload.</li>
              <li>For voice space recordings and podcasts, you have the consent of all participants to record and publish.</li>
            </ul>
            <p>
              Card scans and images sourced from TCGDex or other catalogue providers are used under their respective
              licences and remain the property of their copyright holders.
            </p>

            <h2 id="conduct" className="mt-8 scroll-mt-20 text-xl font-bold">12. Acceptable Use & Community Guidelines</h2>
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
              <li>Record in-platform voice spaces without the visible recording indicator enabled, or publish recordings without participant consent.</li>
              <li>Use direct messages to send unsolicited commercial messages or to circumvent moderation.</li>
              <li>Abuse the AI scanner by submitting fraudulent corrections designed to poison the model.</li>
            </ul>

            <h2 id="moderation" className="mt-8 scroll-mt-20 text-xl font-bold">13. Moderation, Bot Protection & Enforcement</h2>
            <p>
              SwapPulse uses a combination of automated AI moderation, bot-protection scoring, and human moderators to
              enforce these Terms. We may remove content, issue warnings, shadow-ban, or suspend accounts that
              violate these Terms. The bot-protection system may challenge or block actions it assesses as automated
              abuse; repeated or severe violations may result in permanent termination. You may appeal moderation
              decisions through the platform's feedback mechanism.
            </p>

            <h2 id="donations" className="mt-8 scroll-mt-20 text-xl font-bold">14. Donations & Payments</h2>
            <p>
              SwapPulse is funded by voluntary donations processed by <strong>Base44 Payments</strong>. Donations are
              voluntary and do not unlock any paid features, all features remain free regardless of whether you
              donate. By making a donation:
            </p>
            <ul>
              <li>You agree to the payment provider's terms of service at checkout.</li>
              <li>Donations are non-refundable except where required by law; SwapPulse is not obligated to provide refunds for voluntary donations.</li>
              <li>Donations do not grant any special access, preferential treatment, or ownership stake in SwapPulse.</li>
              <li>SwapPulse is not liable for payment processing errors; payment disputes should be directed to the payment provider.</li>
            </ul>

            <h2 id="ip" className="mt-8 scroll-mt-20 text-xl font-bold">15. Intellectual Property</h2>
            <p>
              The SwapPulse name, logo, software, and design are owned by SwapPulse and licensed under MPL-2.0.
              Pokémon, Pokémon TCG, and all related characters and imagery are trademarks of Nintendo, Game Freak,
              and The Pokémon Company International. SwapPulse is not affiliated with, endorsed by, or sponsored by
              these entities. Card data is sourced from TCGDex under its open data licence.
            </p>

            <h2 id="disclaimer" className="mt-8 scroll-mt-20 text-xl font-bold">16. Disclaimers</h2>
            <p>
              SwapPulse is provided "as is" and "as available" without warranties of any kind, express or implied.
              We do not guarantee that the service will be uninterrupted, secure, or error-free. Card pricing data is
              sourced from third parties and may be inaccurate or outdated. Reputation scores, trust vouches, and
              community signals are subjective and should not be relied upon as guarantees. AI assistant outputs are
              suggestions and not professional advice. End-to-end encrypted messages cannot be recovered if you lose
              your private key.
            </p>
            <p>
              <strong>Multi-language support:</strong> SwapPulse provides interface translations and card catalogue data
              in multiple languages via TCGDex. Translations are provided as a convenience; the English version of
              these Terms is the authoritative version. Card names, set names, and flavour text are sourced from TCGDex
              in your selected language and may differ from official localizations. SwapPulse is not responsible for
              translation inaccuracies or differences between TCGDex data and official Pokémon TCG localizations.
            </p>

            <h2 id="liability" className="mt-8 scroll-mt-20 text-xl font-bold">17. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, SwapPulse and its contributors shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
              arising from your use of the platform. This includes, without limitation, losses arising from failed
              trades or trade chains, lost cards, fraudulent transactions, reliance on reputation or pricing data,
              reliance on AI assistant suggestions, loss of access to encrypted direct messages, or unauthorized
              recording or distribution of voice space audio. Our total liability for any claim shall not exceed any
              amount you have donated to SwapPulse in the 12 months preceding the claim.
            </p>

            <h2 id="indemnity" className="mt-8 scroll-mt-20 text-xl font-bold">18. Indemnity</h2>
            <p>
              You agree to indemnify and hold harmless SwapPulse and its contributors from any claims, damages, or
              expenses (including legal fees) arising from your content, your use of the platform, your trading
              activity, your voice space recordings or podcasts, your direct messages, or your violation of these
              Terms.
            </p>

            <h2 id="termination" className="mt-8 scroll-mt-20 text-xl font-bold">19. Account Termination</h2>
            <p>
              You may delete your account at any time through the Settings page. Account deletion removes your
              SwapPulse-side data; however, content already federated to the AT Protocol network may persist in
              third-party caches. We may suspend or terminate your account if you violate these Terms or if we
              determine that your activity poses a risk to the community.
            </p>

            <h2 id="changes" className="mt-8 scroll-mt-20 text-xl font-bold">20. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be announced through the platform.
              Your continued use of SwapPulse after changes take effect constitutes acceptance of the revised Terms.
              The "Last updated" date at the top of this page reflects the most recent revision.
            </p>

            <h2 id="governing-law" className="mt-8 scroll-mt-20 text-xl font-bold">21. Governing Law</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the
              exclusive jurisdiction of the courts of England and Wales, except that you may bring a claim in your
              local consumer protection court if you are a consumer in the European Union or United Kingdom.
            </p>

            <h2 id="contact" className="mt-8 scroll-mt-20 text-xl font-bold">22. Contact</h2>
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