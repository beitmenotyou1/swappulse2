import React, { useState, useMemo, useEffect } from 'react';
import { getThemeConfig } from '@/lib/profileThemes';
import ThemeHeader from '@/components/profile/ThemeHeader';
import ThemeTabContent from '@/components/profile/ThemeTabContent';
import ProfileTabNav from '@/components/profile/ProfileTabNav';

// ImmersiveProfile — delegates full-profile rendering (header + tab nav + all
// tab content) to the active theme. Each theme defines its own tab set, header
// variant, and accent via THEME_CONFIGS. Owner customisation (section_order,
// hidden_sections) applies within the theme's tab set; tabs not in the theme's
// set are ignored. Privacy filtering via get-profile-config continues to gate
// field visibility regardless of theme.
export default function ImmersiveProfile({
  theme, isOwner, did, profile, config,
  posts, collection, trades, reputation, journals, liveSpace,
  actions, extra, badges, reputationNode, backLink, externalBanner, avatarBadge,
  onReload, isExternal, visitorExtras,
}) {
  const cfg = getThemeConfig(theme);
  const [tab, setTab] = useState(cfg.tabs[0]?.key || 'Posts');

  // Reset to first tab when theme changes.
  useEffect(() => { setTab(cfg.tabs[0]?.key || 'Posts'); }, [theme]);

  const tabs = useMemo(() => {
    const themeTabs = cfg.tabs;
    const ownerExtra = isOwner
      ? [{ key: 'Cross-Posting', label: 'Cross-Post' }, { key: 'Privacy', label: 'Privacy' }]
      : [];
    let allTabs = [...themeTabs, ...ownerExtra];

    // For external (non-member) visitors, restrict to tabs that work with
    // posts-only data from the federated Bluesky feed.
    if (isExternal) {
      const externalAllowed = ['Posts', 'About', 'Home'];
      allTabs = allTabs.filter((t) => externalAllowed.includes(t.key));
    }

    // Apply owner's section_order within the theme's tab set.
    let ordered;
    if (config?.section_order?.length) {
      const order = config.section_order;
      ordered = order
        .map((k) => allTabs.find((t) => t.key === k))
        .filter(Boolean)
        .concat(allTabs.filter((t) => !order.includes(t.key)));
    } else {
      ordered = allTabs;
    }

    // Apply hidden_sections (Posts is never hidden).
    const hidden = new Set(config?.hidden_sections || []);
    return ordered.filter((t) => t.key === 'Posts' || !hidden.has(t.key));
  }, [cfg, isOwner, isExternal, config?.section_order, config?.hidden_sections]);

  return (
    <div className={cfg.containerClass || ''}>
      <ThemeHeader
        variant={cfg.headerVariant}
        theme={theme}
        accentHex={cfg.accentHex}
        profile={profile}
        actions={actions}
        extra={extra}
        badges={badges}
        reputationNode={reputationNode}
        backLink={backLink}
        externalBanner={externalBanner}
        avatarBadge={avatarBadge}
        liveSpace={liveSpace}
        config={config}
      />
      <div className="px-4">
        <ProfileTabNav tabs={tabs} activeTab={tab} onChange={setTab} accentHex={cfg.accentHex} primaryCount={6} />
        <div className="mt-3">
          <ThemeTabContent
            theme={theme}
            tabKey={tab}
            did={did}
            isOwner={isOwner}
            isExternal={isExternal}
            config={config}
            profile={profile}
            posts={posts}
            collection={collection}
            trades={trades}
            reputation={reputation}
            journals={journals}
            liveSpace={liveSpace}
            onReload={onReload}
            visitorExtras={visitorExtras}
          />
        </div>
      </div>
    </div>
  );
}