import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const LAST_UPDATED = '16 August 2026';

const SECTIONS = [
  { id: 'overview', title: '1. Overview' },
  { id: 'data-collected', title: '2. Information We Collect' },
  { id: 'atproto', title: '3. AT Protocol & Public Records' },
  { id: 'federation', title: '4. Federated Data Sharing' },
  { id: 'how-we-use', title: '5. How We Use Your Data' },
  { id: 'cookies', title: '6. Cookies & Local Storage' },
  { id: 'push', title: '7. Push Notifications' },
  { id: 'third-parties', title: '8. Third-Party Services' },
  { id: 'retention', title: '9. Data Retention' },
  { id: 'rights', title: '10. Your Rights' },
  { id: 'children', title: '11. Children\'s Privacy' },
  { id: 'security', title: '12. Security' },
  { id: 'changes', title: '13. Changes to This Policy' },
  { id: 'contact', title: '14. Contact' },
];

export default function Privacy() {
  return (
    <>
      <PageHeader title="Privacy Policy" subtitle={`Last updated: ${LAST_UPDATED}`} />
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
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Scroll to read all sections</span>
            </div>

            <p className="text-sm text-muted-foreground">
              This Privacy Policy explains how SwapPulse collects, uses, and protects your personal data. SwapPulse is
              built on the AT Protocol, which is a decentralized social network — this has important implications for
              your privacy that are explained below. By using SwapPulse, you consent to the practices described here.
            </p>

            <h2 id="overview" className="mt-8 scroll-mt-20 text-xl font-bold">1. Overview</h2>
            <p>
              SwapPulse is a decentralized platform. Your data is stored on a Personal Data Server (PDS) and federated
              across the AT Protocol network. This means your data is not held in a single, centralized database — it
              is replicated across independent servers that make up the network. This design prioritizes user
              ownership and portability, but it also means that once data is published to the network, it may be
              difficult to fully remove.
            </p>

            <h2 id="data-collected" className="mt-8 scroll-mt-20 text-xl font-bold">2. Information We Collect</h2>
            <p><strong>Account data:</strong> Your email address (used for login and account recovery), display name,
            handle, and profile avatar. Your email is not displayed publicly.</p>
            <p><strong>Profile data:</strong> Bio, location, and preferences you choose to share on your profile.</p>
            <p><strong>Collection data:</strong> Cards you add to your digital collection, including condition, variant,
            and acquisition details. This is public by default to enable trading.</p>
            <p><strong>Trading data:</strong> Trade listings you create, trade messages, trade feedback, and dispute
            records. Trade messages between participants are visible to the parties involved.</p>
            <p><strong>Social data:</strong> Posts, comments, reactions, likes, reposts, follows, journal entries,
            binder displays, and card reviews you create.</p>
            <p><strong>Activity data:</strong> Meetup RSVPs, challenge entries, voice space participation, and
            achievement records.</p>
            <p><strong>Technical data:</strong> Browser type, device information, and usage logs collected
              automatically when you use the platform.</p>

            <h2 id="atproto" className="mt-8 scroll-mt-20 text-xl font-bold">3. AT Protocol & Public Records</h2>
            <p>
              When you create content on SwapPulse (posts, trades, collection entries, follows, reactions), it is
              published as a public record on your PDS using the AT Protocol. These records are:
            </p>
            <ul>
              <li><strong>Publicly readable</strong> by anyone on the AT Protocol network, including Bluesky and other compatible apps.</li>
              <li><strong>Replicated</strong> across the network — other servers may cache copies of your records.</li>
              <li><strong>Permanent</strong> in the sense that deleting a record on your PDS does not guarantee removal from all federated caches or third-party archives.</li>
              <li><strong>Portable</strong> — your identity (DID) and data belong to you and can be moved to another PDS.</li>
            </ul>
            <p>
              Think of posting on SwapPulse like posting on a public bulletin board: once it's up, many people may see
              it and some may copy it. Do not post content you would not want to be public.
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
              outbound federation of your records, but note that <strong>site functions become limited</strong> — your
              posts, trades, and profile will not appear on Bluesky or other federated apps. You can turn it off at any
              time to re-enable full federation.
            </p>

            <h2 id="how-we-use" className="mt-8 scroll-mt-20 text-xl font-bold">5. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul>
              <li>Operate the platform — display your profile, collection, posts, and trades.</li>
              <li>Authenticate you and maintain your session.</li>
              <li>Send notifications about activity relevant to you (likes, replies, trade matches, price alerts).</li>
              <li>Match your wishlist against new trade listings.</li>
              <li>Calculate reputation, trust scores, and achievement progress.</li>
              <li>Moderate content and enforce community guidelines.</li>
              <li>Analyze usage patterns to improve the platform (in aggregate, not individually identifying).</li>
            </ul>
            <p>
              We do not sell your personal data to third parties. We do not use your data for targeted advertising.
              SwapPulse is funded by voluntary donations, not by data monetization.
            </p>

            <h2 id="cookies" className="mt-8 scroll-mt-20 text-xl font-bold">6. Cookies & Local Storage</h2>
            <p>
              When you first visit SwapPulse, a cookie consent banner lets you choose which categories of cookies and
              local storage you allow. You can revisit and change your choices at any time in{' '}
              <Link to="/settings" className="text-primary hover:underline">Settings → Data & Rights</Link>.
            </p>
            <p><strong>Essential</strong> — login, session, and security. Always on; required for the site to function.</p>
            <p><strong>Functional</strong> — preferences (theme, language, accessibility), offline cache, and PWA features.</p>
            <p><strong>Analytics</strong> — aggregate usage insights. No individual tracking or third-party profiling.</p>
            <p><strong>Marketing</strong> — onboarding emails and the weekly digest. Off by default.</p>
            <p>
              We do not use third-party tracking cookies. Your session token is stored locally on your device and is
              sent only to SwapPulse and your PDS. As a Progressive Web App (PWA), SwapPulse stores a service worker
              and cached assets on your device for offline use. You can clear this data through your browser settings
              at any time.
            </p>

            <h2 id="push" className="mt-8 scroll-mt-20 text-xl font-bold">7. Push Notifications</h2>
            <p>
              If you opt in, SwapPulse can send push notifications to your device for activity such as trade matches,
              replies, and mentions. Push notifications are optional and can be configured or disabled in Settings.
              We use VAPID keys for web push; your push token is stored on our servers to deliver notifications and
              is not shared with third parties.
            </p>

            <h2 id="third-parties" className="mt-8 scroll-mt-20 text-xl font-bold">8. Third-Party Services</h2>
            <p>
              SwapPulse integrates with or relies on the following third-party services:
            </p>
            <ul>
              <li><strong>TCGDex</strong> — Card catalog data (card names, sets, rarities, images). Your collection references TCGDex card IDs.</li>
              <li><strong>AT Protocol / Bluesky</strong> — Federated identity and content storage. Your DID and records are visible on the AT Protocol network.</li>
              <li><strong>Email provider</strong> — We use an SMTP service to send login codes and notifications to your email address.</li>
              <li><strong>Map services</strong> — Meetup locations are displayed using Leaflet/OpenStreetMap.</li>
            </ul>
            <p>
              Each of these services has its own privacy policy. SwapPulse is not responsible for how third parties
              handle your data once it is shared with them through normal platform operation.
            </p>

            <h2 id="retention" className="mt-8 scroll-mt-20 text-xl font-bold">9. Data Retention</h2>
            <p>
              Your SwapPulse-side data is retained for as long as your account is active. When you delete your account,
              we remove your profile, collection, posts, and other SwapPulse-stored data from our servers. However:
            </p>
            <ul>
              <li>Content already federated to the AT Protocol network may persist on other PDSs and in third-party caches.</li>
              <li>Moderation logs and dispute records may be retained for a reasonable period for audit and legal purposes.</li>
              <li>Anonymized, aggregated analytics data may be retained indefinitely.</li>
            </ul>

            <h2 id="rights" className="mt-8 scroll-mt-20 text-xl font-bold">10. Your Rights</h2>
            <p>
              Depending on your jurisdiction (GDPR, CCPA, UK Data Protection Act), you have the right to exercise the
              following. SwapPulse provides a dedicated{' '}
              <Link to="/settings" className="text-primary hover:underline">Data & Privacy Rights</Link> center in
              Settings where you can exercise all of these rights directly:
            </p>
            <ul>
              <li><strong>Access</strong> — Request a copy of your personal data. Use "Download my data" in Settings for an instant JSON archive, or submit an access request for an emailed copy.</li>
              <li><strong>Rectification</strong> — Correct inaccurate data. Update your profile in Settings, or submit a rectification request for data you cannot edit yourself.</li>
              <li><strong>Erasure</strong> — Delete your account through Settings → Account → Danger zone. For partial erasure, submit an erasure request and we will review it.</li>
              <li><strong>Portability</strong> — Export your data in a machine-readable JSON format using "Download my data." The AT Protocol is designed for portability; your data is yours.</li>
              <li><strong>Objection</strong> — Opt out of certain processing, including federation (Do Not Sell or Share), push notifications, and email digests, in Settings → Data & Rights.</li>
              <li><strong>Restriction</strong> — Request that we limit processing of your data temporarily. Submit a restriction request in Settings → Data & Rights.</li>
              <li><strong>Withdraw consent</strong> — Withdraw consent for marketing emails, analytics, and push notifications at any time in Settings → Data & Rights.</li>
              <li><strong>Do Not Sell or Share (CCPA)</strong> — Opt out of having your data federated to the wider AT Protocol network. See Section 4 for details on how this limits site functions.</li>
            </ul>
            <p>
              To exercise these rights, use the Data & Privacy Rights center in Settings, or contact us through the
              Help page. We will respond to all requests within 30 days, as required by law.
            </p>

            <h2 id="children" className="mt-8 scroll-mt-20 text-xl font-bold">11. Children's Privacy</h2>
            <p>
              SwapPulse is not directed at children under 13. Users must be at least 13 years old to create an
              account. Users under 16 require parental or guardian consent. We do not knowingly collect data from
              children under 13. If you believe a child under 13 has registered, please contact us and we will
              remove the account.
            </p>

            <h2 id="security" className="mt-8 scroll-mt-20 text-xl font-bold">12. Security</h2>
            <p>
              We take reasonable measures to protect your data, including encrypted transmission (TLS), secure
              session management, and access controls. However, no system is perfectly secure. Your AT Protocol
              credentials (DID and signing keys) are managed by your PDS; you should protect your account and not
              share login details. We are not liable for breaches of third-party AT Protocol services.
            </p>

            <h2 id="changes" className="mt-8 scroll-mt-20 text-xl font-bold">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be announced through the
              platform. Your continued use of SwapPulse after changes take effect constitutes acceptance of the
              revised policy. The "Last updated" date reflects the most recent revision.
            </p>

            <h2 id="contact" className="mt-8 scroll-mt-20 text-xl font-bold">14. Contact</h2>
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