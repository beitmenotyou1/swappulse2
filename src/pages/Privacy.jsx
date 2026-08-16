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
              SwapPulse uses browser local storage and session storage to maintain your login session, store
              preferences (theme, language, accessibility settings), and cache data for offline use. We do not use
              third-party tracking cookies or analytics cookies. Your session token is stored locally on your device
              and is sent only to SwapPulse and your PDS.
            </p>
            <p>
              As a Progressive Web App (PWA), SwapPulse stores a service worker and cached assets on your device to
              enable offline functionality and faster loading. You can clear this data through your browser settings
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
            <p>Depending on your jurisdiction (GDPR, CCPA, UK Data Protection Act), you may have the right to:</p>
            <ul>
              <li><strong>Access</strong> — Request a copy of your personal data. You can export your data through the Settings page or via the AT Protocol repo export.</li>
              <li><strong>Rectification</strong> — Correct inaccurate profile information through the Settings page.</li>
              <li><strong>Erasure</strong> — Delete your account through the Settings page. See Section 9 for limitations.</li>
              <li><strong>Portability</strong> — Export your data in a machine-readable format. The AT Protocol is designed for this; your data is portable by design.</li>
              <li><strong>Objection</strong> — Opt out of certain data processing, such as push notifications and email digests, through Settings.</li>
              <li><strong>Withdraw consent</strong> — Withdraw consent for optional features (push notifications, email digests) at any time.</li>
            </ul>
            <p>
              To exercise these rights, use the in-app Settings page or contact us through the Help page. We will
              respond within 30 days.
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