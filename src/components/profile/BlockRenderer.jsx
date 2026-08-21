import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Sparkles, Layers } from 'lucide-react';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';
import EngagementHub from '@/components/profile/EngagementHub';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import { BLOCK_LABELS } from '@/lib/profileThemes';
import { useT } from '@/lib/i18n/I18nProvider';

// BlockShell — shared section wrapper used by ProfileBlocks and every
// platform theme so cards have a consistent surface.
export function BlockShell({ title, children, className = '', accent = '' }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 ${accent} ${className}`}>
      {title && <h3 className="mb-2 text-sm font-bold">{title}</h3>}
      {children}
    </section>
  );
}

function BadgeRow({ items, icon: Icon, linkField, findKey }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v, i) => (
        <Link
          key={i}
          to={`/discover/users?field=${linkField}&value=${encodeURIComponent(v)}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          aria-label={t(findKey, { value: v })}
          title={t(findKey, { value: v })}
        >
          {Icon && <Icon className="h-3 w-3" />} {v}
        </Link>
      ))}
    </div>
  );
}

// BlockRenderer — renders a single About-section content block by key.
// Shared by ProfileBlocks (gradient themes) and every platform theme so
// blocks render identically regardless of where they're placed.
export default function BlockRenderer({ blockKey, data, did, isOwner }) {
  if (blockKey === 'interests') {
    if (!data?.interests?.length) return null;
    return <BlockShell title={BLOCK_LABELS.interests}><BadgeRow items={data.interests} linkField="interest" findKey="discoverUsers.findInterest" /></BlockShell>;
  }
  if (blockKey === 'favourite_pokemon') {
    if (!data?.favourite_pokemon?.length) return null;
    return <BlockShell title={BLOCK_LABELS.favourite_pokemon}><BadgeRow items={data.favourite_pokemon} icon={Sparkles} linkField="pokemon" findKey="discoverUsers.findPokemon" /></BlockShell>;
  }
  if (blockKey === 'favourite_sets') {
    if (!data?.favourite_sets?.length) return null;
    return <BlockShell title={BLOCK_LABELS.favourite_sets}><BadgeRow items={data.favourite_sets} icon={Layers} linkField="set" findKey="discoverUsers.findSet" /></BlockShell>;
  }
  if (blockKey === 'milestones') {
    if (!data?.milestones?.length) return null;
    return <BlockShell title={BLOCK_LABELS.milestones}><MilestonesTimeline milestones={data.milestones} /></BlockShell>;
  }
  if (blockKey === 'contact') {
    // Location, website, and social links now render in the profile header
    // (ProfileInfoRow). The contact block shows only the contact email.
    if (!data?.contact_email) return null;
    return (
      <BlockShell title={BLOCK_LABELS.contact}>
        <div className="space-y-1.5 text-sm">
          <a href={`mailto:${data.contact_email}`} className="flex items-center gap-1.5 break-all text-primary hover:underline"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {data.contact_email}</a>
        </div>
      </BlockShell>
    );
  }
  if (blockKey === 'binder') {
    return <BlockShell title={BLOCK_LABELS.binder}><NetworkFeedSection type="collections" did={did} limit={9} showHeader={false} /></BlockShell>;
  }
  if (blockKey === 'trades') {
    return <BlockShell title={BLOCK_LABELS.trades}><NetworkFeedSection type="trades" did={did} limit={5} showHeader={false} /></BlockShell>;
  }
  if (blockKey === 'collections') {
    return <BlockShell title={BLOCK_LABELS.collections}><NetworkFeedSection type="collections" did={did} limit={12} showHeader={false} /></BlockShell>;
  }
  if (blockKey === 'hub') {
    return <BlockShell title={BLOCK_LABELS.hub}><EngagementHub did={did} /></BlockShell>;
  }
  return null;
}