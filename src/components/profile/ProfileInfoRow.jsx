import React from 'react';
import { MapPin, Globe, Link as LinkIcon, Twitter, Instagram, Youtube, Github, Linkedin, Facebook, Twitch, AtSign } from 'lucide-react';
import { confirmExternalLink, isExternalUrl } from '@/lib/externalLink';
import { Link } from 'react-router-dom';
import { useT } from '@/lib/i18n/I18nProvider';

// Platform detection from URL — maps social links to brand-appropriate icons.
// Falls back to a generic Link icon for unrecognised platforms.
const SOCIAL_ICONS = [
  { match: /(?:twitter\.com|x\.com)/i, Icon: Twitter, label: 'Twitter / X' },
  { match: /instagram\.com/i, Icon: Instagram, label: 'Instagram' },
  { match: /(?:youtube\.com|youtu\.be)/i, Icon: Youtube, label: 'YouTube' },
  { match: /github\.com/i, Icon: Github, label: 'GitHub' },
  { match: /linkedin\.com/i, Icon: Linkedin, label: 'LinkedIn' },
  { match: /facebook\.com/i, Icon: Facebook, label: 'Facebook' },
  { match: /twitch\.tv/i, Icon: Twitch, label: 'Twitch' },
  { match: /(?:bsky\.app|bluesky)/i, Icon: AtSign, label: 'Bluesky' },
];

function iconForUrl(url) {
  for (const s of SOCIAL_ICONS) {
    if (s.match.test(url)) return s;
  }
  return { Icon: LinkIcon, label: 'Link' };
}

// ProfileInfoRow — compact, icon-only row of location, website, and social
// links rendered below the bio in the profile header. No text labels — icons
// carry the meaning. Uses theme-agnostic muted tokens (text-muted-foreground
// default, hover:text-primary) so it complements all 10 profile themes without
// per-theme hardcoding. `config` is the (visitor-filtered) ProfileConfig —
// fields the viewer isn't permitted to see are already stripped upstream by
// get-profile-config, so this component just renders whatever is present.
export default function ProfileInfoRow({ config }) {
  const t = useT();
  if (!config) return null;

  // Owner config has fields at the top level; visitor config (from
  // get-profile-config) nests filtered fields under `personal`. Unify both.
  const data = config.personal || config;
  const location = data.location;
  const website = data.website;
  const socialLinks = (data.social_links || []).filter((s) => s?.url);

  const hasAny = location || website || socialLinks.length > 0;
  if (!hasAny) return null;

  const handleExternal = (e, url) => {
    if (!isExternalUrl(url)) return;
    e.preventDefault();
    confirmExternalLink(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
      {location && (
        <Link
          to={`/discover/users?field=location&value=${encodeURIComponent(location)}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
          aria-label={t('discoverUsers.findLocation', { value: location })}
          title={t('discoverUsers.findLocation', { value: location })}
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span>{location}</span>
        </Link>
      )}
      {website && (
        <a
          href={isExternalUrl(website) ? undefined : website}
          onClick={(e) => handleExternal(e, website)}
          className="inline-flex max-w-[220px] items-center gap-1.5 transition-colors hover:text-primary"
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="truncate">{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        </a>
      )}
      {socialLinks.map((s, i) => {
        const { Icon, label } = iconForUrl(s.url);
        const ariaLabel = s.label || label;
        return (
          <a
            key={i}
            href={isExternalUrl(s.url) ? undefined : s.url}
            onClick={(e) => handleExternal(e, s.url)}
            title={ariaLabel}
            aria-label={ariaLabel}
            className="inline-flex items-center transition-colors hover:text-primary"
          >
            <Icon className="h-4 w-4 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}