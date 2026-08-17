import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';

const LAST_UPDATED = '17 August 2026';

const SECTIONS = [
  { id: 'overview', title: '1. Overview' },
  { id: 'data-collected', title: '2. Information We Collect' },
  { id: 'atproto', title: '3. AT Protocol & Public Records' },
  { id: 'federation', title: '4. Federated Data Sharing' },
  { id: 'e2ee', title: '5. End-to-End Encrypted Direct Messages' },
  { id: 'voice-podcasts', title: '6. Voice Spaces & Podcast Recordings' },
  { id: 'ai-scanner', title: '7. AI Scanner & Corrections' },
  { id: 'stories', title: '8. Stories (Ephemeral Content)' },
  { id: 'bot-protection', title: '9. Bot Protection & Automated Moderation' },
  { id: 'how-we-use', title: '10. How We Use Your Data' },
  { id: 'cookies', title: '11. Cookies & Local Storage' },
  { id: 'push', title: '12. Push Notifications' },
  { id: 'payments', title: '13. Payments & Donations' },
  { id: 'third-parties', title: '14. Third-Party Services' },
  { id: 'retention', title: '15. Data Retention' },
  { id: 'rights', title: '16. Your Rights' },
  { id: 'children', title: '17. Children\'s Privacy' },
  { id: 'security', title: '18. Security' },
  { id: 'changes', title: '19. Changes to This Policy' },
  { id: 'contact', title: '20. Contact' },
];

export default function Privacy() {
  useSEO({
    title: 'Privacy Policy',
    description: 'SwapPulse Privacy Policy, data collection, AT Protocol federation, E2EE messaging, cookies, and your data rights.',
    canonicalPath: '/privacy',
  });
  return (
    <>
      <PageHeader title="Privacy Policy" subtitle={`Last updated: ${LAST_UPDATED}`} />
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
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Scroll to read all sections</span>
            </div>

            <p className="text-sm text-muted-foreground">
              This Privacy Policy explains how SwapPulse collects, uses, and protects your personal data. SwapPulse is
              built on the AT Protocol, a decentralized social network, this has important implications for your privacy
              that are explained below. SwapPulse also offers end-to-end encrypted direct messages, live voice spaces,
              an AI card scanner, and ephemeral stories, each of which has its own data practices described here. By
              using SwapPulse, you consent to the practices described in this policy.
            </p>

            <h2 id="overview" className="mt-8 scroll-mt-20 text-xl font-bold">1. Overview</h2>
            <p>
              SwapPulse is a decentralized platform. Your data is stored on a Personal Data Server (PDS) and federated
              across the AT Protocol network. This means your data is not held in a single, centralized database, it
              is replicated across independent servers that make up the network. This design prioritizes user ownership
              and portability, but it also means that once data is published to the network, it may be difficult to
              fully remove. Some data, such as end-to-end encrypted direct messages and your private encryption keys —
              never leaves your device in a readable form and is never federated.
            </p>

            <h2 id="data-collected" className="mt-8 scroll-mt-20 text-xl font-bold">2. Information We Collect</h2>
            <p><strong>Account data:</strong> Your email address (used for login and account recovery), display name,
            handle, and profile avatar. Your email is not displayed publicly.</p>
            <p><strong>Profile data:</strong> Bio, location, and preferences you choose to share on your profile.</p>
            <p><strong>Collection data:</strong> Cards you add to your digital collection, including condition, variant,
            and acquisition details. This is public by default to enable trading and is mirrored to your PDS.</p>
            <p><strong>Trading data:</strong> Trade listings, trade messages, trade chains, trade feedback, and dispute
            records. Public listings and feedback are federated; trade messages within a negotiation are visible to the
            parties involved.</p>
            <p><strong>Social data:</strong> Posts, comments, reactions, likes, reposts, follows, journal entries,
            binder displays, card reviews, and pack-opening posts you create.</p>
            <p><strong>Direct messages:</strong> End-to-end encrypted 1:1 conversations. Only ciphertext is stored on
            our servers and mirrored to your PDS; the encryption keys never leave your device. See Section 5.</p>
            <p><strong>Voice space data:</strong> Participation in live voice spaces, your role (host, speaker, listener),
            and WebRTC signaling messages exchanged to establish peer connections. See Section 6.</p>
            <p><strong>Story data:</strong> Ephemeral photos, videos, and text you post as stories, which expire after
            24 hours. See Section 8.</p>
            <p><strong>Scanner data:</strong> Card photos you submit to the AI scanner and any corrections you submit
            when the top match is wrong. See Section 7.</p>
            <p><strong>Activity data:</strong> Meetup RSVPs, challenge entries, pack party participation, pull
            nominations, achievement records, and sentiment poll votes.</p>
            <p><strong>Bot-protection data:</strong> Hashed IP addresses, risk scores, and challenge outcomes used to
            detect automated abuse. See Section 9.</p>
            <p><strong>Technical data:</strong> Browser type, device information, and usage logs collected
              automatically when you use the platform.</p>

            <h2 id="atproto" className="mt-8 scroll-mt-20 text-xl font-bold">3. AT Protocol & Public Records</h2>
            <p>
              When you create content on SwapPulse (posts, trades, collection entries, follows, reactions, voice spaces,
              podcast episodes, stories, journal entries, and more), it is published as a public record on your PDS
              using the AT Protocol. These records are:
            </p>
            <ul>
              <li><strong>Publicly readable</strong> by anyone on the AT Protocol network, including Bluesky and other compatible apps.</li>
              <li><strong>Replicated</strong> across the network, other servers may cache copies of your records.</li>
              <li><strong>Permanent</strong> in the sense that deleting a record on your PDS does not guarantee removal from all federated caches or third-party archives.</li>
              <li><strong>Portable</strong>, your identity (DID) and data belong to you and can be moved to another PDS.</li>
            </ul>
            <p>
              Direct message bodies are the exception: they are end-to-end encrypted before being mirrored, so only you
              and your conversation partner can read them. Think of posting on SwapPulse like posting on a public
              bulletin board: once it's up, many people may see it and some may copy it. Do not post content you would
              not want to be public.
            </p>
            <p>
              <strong>Card embeds:</strong> When you attach a card to a post, the post is bridged to the AT Protocol
              with an app.bsky.embed.external embed containing the SwapPulse card page URL, the card image (served
              from TCGDex's CDN), and the localized card name. This embed is public and federates like any other post
              content. Clicking the embed on Bluesky deep-links to the SwapPulse card page.
            </p>

            <h2 id="federation" className="mt-8 scroll-mt-20 text-xl font-bold">4. Federated Data Sharing</h2>
            <p>
              Your data is shared with other AT Protocol servers (PDSs) and applications as part of normal federation.
              This includes:
            </p>
            <ul>
              <li><strong>AppView services</strong> (including bsky.app) that index AT Protocol records for search and discovery.</li>
              <li><strong>Other PDSs</strong> that follow you or your connections and cache your content locally.</li>
              <li><strong>Feed generators</strong> that aggregate and rank content for custom feeds.</li>
              <li><strong>Labelers</strong> that apply moderation labels to content across the network.</li>
            </ul>
            <p>
              SwapPulse does not control how third-party AT Protocol services handle your data once they receive it.
              Their privacy practices are governed by their own policies.
            </p>
            <p>
              <strong>CCPA opt-out:</strong> Under the California Consumer Privacy Act, federating your data to the
              wider AT Protocol network counts as a "share." If you do not want your records shared, you can enable{' '}
              <strong>"Do Not Sell or Share My Personal Information"</strong> in{' '}
              <Link to="/settings" className="text-primary hover:underline">Settings → Data & Rights</Link>. This stops
              outbound federation of your records, but note that <strong>site functions become limited</strong>, your
              posts, trades, and profile will not appear on Bluesky or other federated apps. You can turn it off at any
              time to re-enable full federation.
            </p>

            <h2 id="e2ee" className="mt-8 scroll-mt-20 text-xl font-bold">5. End-to-End Encrypted Direct Messages</h2>
            <p>
              SwapPulse offers 1:1 direct messages with end-to-end encryption (E2EE). When you first use direct messages,
              your browser generates an ECDH (P-256) key pair. Your <strong>private key never leaves your device</strong>{' '}
             , it is stored in your browser's IndexedDB. Your public key is published so others can encrypt messages to
              you. Messages are encrypted in your browser before they are sent; only ciphertext is stored on our
              servers and mirrored to your PDS.
            </p>
            <ul>
              <li><strong>We cannot read your messages.</strong> SwapPulse has no access to your private key and cannot decrypt your message content.</li>
              <li><strong>No backdoor.</strong> There is no way for SwapPulse to recover encrypted messages if you lose your device or clear your browser data.</li>
              <li><strong>Message metadata</strong>, who you talk to and when, is visible to the platform (needed to route and display conversations), but the message body is not.</li>
              <li><strong>Cross-device access</strong> is not currently supported; your encrypted message history is tied to the browser where your private key lives.</li>
            </ul>

            <h2 id="voice-podcasts" className="mt-8 scroll-mt-20 text-xl font-bold">6. Voice Spaces & Podcast Recordings</h2>
            <p>
              SwapPulse voice spaces operate in two modes. <strong>External mode</strong> is a manual Go Live declaration
              pointing at an external stream URL (Twitch, YouTube, Kick, etc.), we store only the URL and metadata you
              provide, not the stream content. <strong>In-platform mode</strong> uses a WebRTC peer mesh so participants
              can hear each other directly in the browser.
            </p>
            <p>For in-platform voice spaces, the following data is collected:</p>
            <ul>
              <li><strong>Participant records</strong>, your role (host, co-host, speaker, listener), hand-raised status, and join/leave times.</li>
              <li><strong>WebRTC signaling messages</strong>, offers, answers, and ICE candidates exchanged between peers to establish the audio mesh. These are ephemeral and consumed in real time.</li>
              <li><strong>Audio</strong>, in-platform audio is transmitted peer-to-peer between participants' browsers and is not recorded unless the host explicitly enables recording.</li>
            </ul>
            <p>
              If the host enables recording, the mixed stage audio is uploaded and stored as a file. The host can then
              publish it as a <strong>podcast episode</strong> with metadata (title, description, chapters, show notes).
              Published episodes are included in a public <strong>RSS feed</strong> so external podcast apps can
              subscribe and download them. The RSS feed URL is public and can be submitted to any podcast directory.
            </p>

            <h2 id="ai-scanner" className="mt-8 scroll-mt-20 text-xl font-bold">7. AI Scanner & Corrections</h2>
            <p>
              The SwapPulse AI scanner lets you photograph a card and identifies it from the TCGDex catalog. When you
              use the scanner:
            </p>
            <ul>
              <li><strong>Card photos</strong> are uploaded and processed by an AI model to identify the card. The photo is not permanently stored beyond the scanning session unless you choose to save it to a post or collection entry.</li>
              <li><strong>Corrections</strong>, when the top match is wrong and you select the correct card or search manually, are recorded as ScannerCorrection records. These record the original match, your correction, and (if available) a hashed device identifier.</li>
              <li><strong>Model improvement:</strong> Your corrections are used to evaluate and improve the scanner model's accuracy over time. Corrections work offline too: they queue locally and sync when you reconnect.</li>
            </ul>
            <p>
              AI assistants (Trade Assistant, Market Watch Assistant, Collection Advisor, and others) process your
              collection and trade data to generate suggestions. The suggestions are generated by an LLM and are
              advisory only, see the Terms of Service for details.
            </p>

            <h2 id="stories" className="mt-8 scroll-mt-20 text-xl font-bold">8. Stories (Ephemeral Content)</h2>
            <p>
              Stories are ephemeral posts (photos, videos, or text) that expire after <strong>24 hours</strong>. When you
              post a story:
            </p>
            <ul>
              <li>The media is uploaded and a story record is created with an expiry timestamp.</li>
              <li>Stories are mirrored to your PDS as a real record; the AppView filters expired stories from feeds after 24 hours.</li>
              <li><strong>View tracking:</strong> We record which accounts have viewed your story so the seen/unseen ring state works. This view data is visible to the story author.</li>
              <li>After 24 hours, stories are removed from the feed and from our active storage. The PDS record may persist for audit purposes but is not surfaced.</li>
            </ul>
            <p>
              Because stories are mirrored to your PDS, a copy may persist in federated caches even after expiry. Do
              not post anything in a story that you would not want potentially retained.
            </p>

            <h2 id="bot-protection" className="mt-8 scroll-mt-20 text-xl font-bold">9. Bot Protection & Automated Moderation</h2>
            <p>
              SwapPulse uses a bot-protection system to detect and prevent automated abuse (spam posts, fake accounts,
              mass-following, scam listings). When you take a write action, the system may:
            </p>
            <ul>
              <li>Compute a <strong>risk score</strong> based on signals like account age, action velocity, content diversity, and browser fingerprint.</li>
              <li>Store a <strong>hashed version of your IP address</strong> for audit, we never store your raw IP.</li>
              <li>Issue a <strong>"verify you're human" challenge</strong> (captcha) for borderline-risk actions.</li>
              <li>Temporarily block subjects with repeated challenge failures.</li>
            </ul>
            <p>
              Bot-protection state (risk scores, challenge history) is retained for as long as needed to detect abuse
              patterns. AI moderation also scans posts and comments for toxic content and applies labels; these labels
              and review decisions are retained for moderation audit.
            </p>

            <h2 id="how-we-use" className="mt-8 scroll-mt-20 text-xl font-bold">10. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul>
              <li>Operate the platform, display your profile, collection, posts, trades, binders, and voice spaces.</li>
              <li>Authenticate you and maintain your session.</li>
              <li>Send notifications about activity relevant to you (likes, replies, trade matches, price alerts, voice spaces going live).</li>
              <li>Match your wishlist against new trade listings.</li>
              <li>Calculate reputation, trust scores, and achievement progress.</li>
              <li>Power AI assistants that analyze your collection and trades to generate suggestions.</li>
              <li>Moderate content, detect bots, and enforce community guidelines.</li>
              <li>Analyze usage patterns to improve the platform (in aggregate, not individually identifying).</li>
            </ul>
            <p>
              We do not sell your personal data to third parties. We do not use your data for targeted advertising.
              SwapPulse is funded by voluntary donations, not by data monetization.
            </p>
            <p>
              <strong>Language preferences:</strong> When you choose a language via the language switcher, your
              preference is stored in your browser's local storage and, if you are logged in, on your account. We use
              this to display the interface and card catalog in your preferred language. Card and set names are fetched
              from TCGDex in the language you select. Your language preference is not shared with third parties.
            </p>

            <h2 id="cookies" className="mt-8 scroll-mt-20 text-xl font-bold">11. Cookies & Local Storage</h2>
            <p>
              When you first visit SwapPulse, a cookie consent banner lets you choose which categories of cookies and
              local storage you allow. You can revisit and change your choices at any time in{' '}
              <Link to="/settings" className="text-primary hover:underline">Settings → Data & Rights</Link>.
            </p>
            <p><strong>Essential</strong>, login, session, and security. Always on; required for the site to function.</p>
            <p><strong>Functional</strong>, preferences (theme, language, accessibility), offline cache, E2EE private keys (IndexedDB), and PWA features.</p>
            <p><strong>Analytics</strong>, aggregate usage insights. No individual tracking or third-party profiling.</p>
            <p><strong>Marketing</strong>, onboarding emails and the weekly digest. Off by default.</p>
            <p>
              We do not use third-party tracking cookies. Your session token is stored locally on your device and is
              sent only to SwapPulse and your PDS. As a Progressive Web App (PWA), SwapPulse stores a service worker
              and cached assets on your device for offline use. You can clear this data through your browser settings
              at any time. Note: clearing IndexedDB will remove your E2EE private key and you will lose access to
              encrypted direct messages on that device.
            </p>

            <h2 id="push" className="mt-8 scroll-mt-20 text-xl font-bold">12. Push Notifications</h2>
            <p>
              If you opt in, SwapPulse can send push notifications to your device for activity such as trade matches,
              replies, mentions, price alerts, and voice spaces going live. Push notifications are optional and can be
              configured or disabled in Settings, including per-event-type preferences and quiet hours. We use VAPID
              keys for web push; your push token is stored on our servers to deliver notifications and is not shared
              with third parties. If you install SwapPulse as a native mobile app, push notifications are delivered
              through the platform's mobile push service.
            </p>

            <h2 id="payments" className="mt-8 scroll-mt-20 text-xl font-bold">13. Payments & Donations</h2>
            <p>
              SwapPulse is free and funded by voluntary donations. Donations are processed by{' '}
              <strong>Base44 Payments</strong> (our payment provider). When you make a donation:
            </p>
            <ul>
              <li>You are redirected to the payment provider's checkout page, which collects your payment details. We never see or store your card number or full payment credentials.</li>
              <li>The payment provider sends us a confirmation with a checkout session ID and the amount. We use this to record your donation and send a receipt.</li>
              <li>Your email may be collected by the payment provider at checkout; we do not use it to correlate donations to your SwapPulse account unless you are logged in.</li>
            </ul>
            <p>
              Donation records are retained for accounting purposes. See the Terms of Service for donation terms.
            </p>

            <h2 id="third-parties" className="mt-8 scroll-mt-20 text-xl font-bold">14. Third-Party Services</h2>
            <p>
              SwapPulse integrates with or relies on the following third-party services:
            </p>
            <ul>
              <li><strong>TCGDex</strong>, Card catalog data (card names, sets, rarities, images). Your collection references TCGDex card IDs.</li>
              <li><strong>AT Protocol / Bluesky</strong>, Federated identity and content storage. Your DID and records are visible on the AT Protocol network.</li>
              <li><strong>AI / LLM providers</strong>, Power the card scanner, AI assistants, and automated moderation. Prompts and card photos are sent to these providers for processing.</li>
              <li><strong>Image generation</strong>, Used for AI-generated images when you request them. Generated images are stored and linked to your account.</li>
              <li><strong>Audio transcription</strong>, Used to transcribe voice space recordings into text for podcast show notes.</li>
              <li><strong>Email provider (SMTP)</strong>, We use an SMTP service to send login codes, notifications, and digests to your email address.</li>
              <li><strong>Base44 Payments</strong>, Processes donations. See Section 13.</li>
              <li><strong>Map services</strong>, Meetup locations are displayed using Leaflet/OpenStreetMap.</li>
              <li><strong>Podcast directories</strong>, Your public RSS feed may be indexed by Apple Podcasts, Spotify, and other podcast apps once you submit the feed URL.</li>
            </ul>
            <p>
              Each of these services has its own privacy policy. SwapPulse is not responsible for how third parties
              handle your data once it is shared with them through normal platform operation.
            </p>

            <h2 id="retention" className="mt-8 scroll-mt-20 text-xl font-bold">15. Data Retention</h2>
            <p>
              Your SwapPulse-side data is retained for as long as your account is active. When you delete your account,
              we remove your profile, collection, posts, direct messages, and other SwapPulse-stored data from our
              servers. However:
            </p>
            <ul>
              <li>Content already federated to the AT Protocol network may persist on other PDSs and in third-party caches.</li>
              <li>Moderation logs, bot-protection audit records, and dispute records may be retained for a reasonable period for audit and legal purposes.</li>
              <li>Scanner corrections may be retained in anonymized form for model improvement.</li>
              <li>Podcast episodes published to your RSS feed may be cached by external podcast apps even after deletion on SwapPulse.</li>
              <li>Anonymized, aggregated analytics data may be retained indefinitely.</li>
              <li>E2EE direct messages: once your account is deleted, the ciphertext is removed from our servers. Messages already decrypted on a recipient's device remain there under their control.</li>
            </ul>

            <h2 id="rights" className="mt-8 scroll-mt-20 text-xl font-bold">16. Your Rights</h2>
            <p>
              Depending on your jurisdiction (GDPR, CCPA, UK Data Protection Act), you have the right to exercise the
              following. SwapPulse provides a dedicated{' '}
              <Link to="/settings" className="text-primary hover:underline">Data & Privacy Rights</Link> center in
              Settings where you can exercise all of these rights directly:
            </p>
            <ul>
              <li><strong>Access</strong>, Request a copy of your personal data. Use "Download my data" in Settings for an instant JSON archive, or submit an access request for an emailed copy.</li>
              <li><strong>Rectification</strong>, Correct inaccurate data. Update your profile in Settings, or submit a rectification request for data you cannot edit yourself.</li>
              <li><strong>Erasure</strong>, Delete your account through Settings → Account → Danger zone. For partial erasure, submit an erasure request and we will review it.</li>
              <li><strong>Portability</strong>, Export your data in a machine-readable JSON format using "Download my data." The AT Protocol is designed for portability; your data is yours.</li>
              <li><strong>Objection</strong>, Opt out of certain processing, including federation (Do Not Sell or Share), push notifications, and email digests, in Settings → Data & Rights.</li>
              <li><strong>Restriction</strong>, Request that we limit processing of your data temporarily. Submit a restriction request in Settings → Data & Rights.</li>
              <li><strong>Withdraw consent</strong>, Withdraw consent for marketing emails, analytics, and push notifications at any time in Settings → Data & Rights.</li>
              <li><strong>Do Not Sell or Share (CCPA)</strong>, Opt out of having your data federated to the wider AT Protocol network. See Section 4 for details on how this limits site functions.</li>
            </ul>
            <p>
              To exercise these rights, use the Data & Privacy Rights center in Settings, or contact us through the
              Help page. We will respond to all requests within 30 days, as required by law.
            </p>

            <h2 id="children" className="mt-8 scroll-mt-20 text-xl font-bold">17. Children's Privacy</h2>
            <p>
              SwapPulse is not directed at children under 13. Users must be at least 13 years old to create an
              account. Users under 16 require parental or guardian consent. We do not knowingly collect data from
              children under 13. If you believe a child under 13 has registered, please contact us and we will
              remove the account.
            </p>

            <h2 id="security" className="mt-8 scroll-mt-20 text-xl font-bold">18. Security</h2>
            <p>
              We take reasonable measures to protect your data, including encrypted transmission (TLS), secure
              session management, and access controls. End-to-end encrypted direct messages use ECDH key exchange
              and AES-GCM encryption; your private key is stored only in your browser's IndexedDB and is never
              transmitted to our servers. However, no system is perfectly secure. Your AT Protocol credentials (DID
              and signing keys) are managed by your PDS; you should protect your account and not share login details.
              We are not liable for breaches of third-party AT Protocol services.
            </p>

            <h2 id="changes" className="mt-8 scroll-mt-20 text-xl font-bold">19. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be announced through the
              platform. Your continued use of SwapPulse after changes take effect constitutes acceptance of the
              revised policy. The "Last updated" date reflects the most recent revision.
            </p>

            <h2 id="contact" className="mt-8 scroll-mt-20 text-xl font-bold">20. Contact</h2>
            <p>
              Questions about this Privacy Policy or requests to exercise your data rights can be submitted through
              the platform's{' '}
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