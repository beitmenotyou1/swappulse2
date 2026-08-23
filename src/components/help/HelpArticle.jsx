import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import useSEO from '@/hooks/useSEO';
import { useT } from '@/lib/i18n/I18nProvider';

export function HelpSection({ icon: Icon, title, children, variant }) {
  const cls = variant === 'warning'
    ? 'rounded-2xl border border-warning/30 bg-warning/10 p-4'
    : variant === 'primary'
      ? 'rounded-2xl border border-primary/30 bg-primary/5 p-4'
      : 'rounded-2xl border border-border bg-card p-4';
  return (
    <section className={cls}>
      {title && (
        <div className="mb-2 flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h2 className="font-bold">{title}</h2>
        </div>
      )}
      <div className="space-y-1 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function HelpSteps({ children }) {
  return <ol className="ml-5 list-decimal space-y-1">{children}</ol>;
}

export function HelpList({ children }) {
  return <ul className="ml-5 list-disc space-y-1">{children}</ul>;
}

export default function HelpArticle({ title, subtitle, slug, children }) {
  const t = useT();
  useSEO({
    title: `${title} – Pokémon TCG Help Guide`,
    description: subtitle || `Learn how to use ${title} on SwapPulse, the decentralized social network for Pokémon TCG collectors.`,
    canonicalPath: `/help/${slug}`,
  });
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Link to="/help" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t('help.helpCentre')}
        </Link>
        {children}
      </div>
    </div>
  );
}