import React from 'react';
import { MapPin, Link as LinkIcon, Mail, Globe, Sparkles, Layers } from 'lucide-react';
import RichText from '@/components/RichText';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';
import EngagementHub from '@/components/profile/EngagementHub';
import NetworkFeedSection from '@/components/feed/NetworkFeedSection';
import { BLOCK_LABELS, DEFAULT_BLOCK_ORDER } from '@/lib/profileThemes';

// ProfileBlocks — renders the About-section content blocks in the owner's
// chosen block_order. `data` is either the owner's full config (owner view) or
// the filtered `personal` object from get-profile-config (visitor view); both
// share the same field names. Personal blocks are skipped when their data is
// empty or withheld by visibility; preview blocks (binder, trades, collections,
// hub) always render so visitors see the collector's public activity.
export default function ProfileBlocks({ data, blockOrder, did, isOwner }) {
  const order = blockOrder?.length ? blockOrder : DEFAULT_BLOCK_ORDER;

  const Block = ({ title, children }) => (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {children}
    </section>
  );

  const BadgeRow = ({ items, icon: Icon }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {Icon && <Icon className="h-3 w-3" />} {v}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 py-4">
      {order.map((key) => {
        if (key === 'bio') {
          if (!data?.bio) return null;
          return (
            <Block key={key} title={BLOCK_LABELS.bio}>
              <RichText text={data.bio} className="text-sm" />
            </Block>
          );
        }
        if (key === 'interests') {
          if (!data?.interests?.length) return null;
          return (
            <Block key={key} title={BLOCK_LABELS.interests}>
              <BadgeRow items={data.interests} />
            </Block>
          );
        }
        if (key === 'favourite_pokemon') {
          if (!data?.favourite_pokemon?.length) return null;
          return (
            <Block key={key} title={BLOCK_LABELS.favourite_pokemon}>
              <BadgeRow items={data.favourite_pokemon} icon={Sparkles} />
            </Block>
          );
        }
        if (key === 'favourite_sets') {
          if (!data?.favourite_sets?.length) return null;
          return (
            <Block key={key} title={BLOCK_LABELS.favourite_sets}>
              <BadgeRow items={data.favourite_sets} icon={Layers} />
            </Block>
          );
        }
        if (key === 'milestones') {
          if (!data?.milestones?.length) return null;
          return (
            <Block key={key} title={BLOCK_LABELS.milestones}>
              <MilestonesTimeline milestones={data.milestones} />
            </Block>
          );
        }
        if (key === 'contact') {
          const hasContact = data?.location || data?.website || data?.contact_email || data?.social_links?.length;
          if (!hasContact) return null;
          return (
            <Block key={key} title={BLOCK_LABELS.contact}>
              <div className="space-y-1.5 text-sm">
                {data.location && (
                  <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {data.location}</p>
                )}
                {data.website && (
                  <a href={data.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 break-all text-primary hover:underline">
                    <LinkIcon className="h-3.5 w-3.5 shrink-0" /> {data.website}
                  </a>
                )}
                {data.contact_email && (
                  <a href={`mailto:${data.contact_email}`} className="flex items-center gap-1.5 break-all text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {data.contact_email}
                  </a>
                )}
                {data.social_links?.filter((s) => s?.url).map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 break-all text-primary hover:underline">
                    <Globe className="h-3.5 w-3.5 shrink-0" /> {s.label || s.platform || s.url}
                  </a>
                ))}
              </div>
            </Block>
          );
        }
        if (key === 'binder') {
          return (
            <Block key={key} title={BLOCK_LABELS.binder}>
              <NetworkFeedSection type="collections" did={did} limit={9} showHeader={false} />
            </Block>
          );
        }
        if (key === 'trades') {
          return (
            <Block key={key} title={BLOCK_LABELS.trades}>
              <NetworkFeedSection type="trades" did={did} limit={5} showHeader={false} />
            </Block>
          );
        }
        if (key === 'collections') {
          return (
            <Block key={key} title={BLOCK_LABELS.collections}>
              <NetworkFeedSection type="collections" did={did} limit={12} showHeader={false} />
            </Block>
          );
        }
        if (key === 'hub') {
          return (
            <Block key={key} title={BLOCK_LABELS.hub}>
              <EngagementHub did={did} />
            </Block>
          );
        }
        return null;
      })}
    </div>
  );
}