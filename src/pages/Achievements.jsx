import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import AchievementMedallion from '@/components/achievements/AchievementMedallion';
import ProofViewerModal from '@/components/achievements/ProofViewerModal';
import { ACHIEVEMENT_ICONS, categoryToPillar, PILLARS } from '@/lib/achievementSpecs';
import DocumentationLink from '@/components/DocumentationLink';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

export default function Achievements() {
  const t = useT();
  useSEO({
    title: 'Achievements',
    description: 'View your Pokémon TCG collector achievements and credentials on SwapPulse.',
    canonicalPath: '/achievements',
  });
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [selected, setSelected] = useState(null);

  const evaluate = useCallback(async () => {
    setEvaluating(true);
    try {
      const res = await base44.functions.invoke('evaluateAchievements', {});
      setRecords(res.data.achievements || []);
      const config = res.data.config;
      if (config?.achievements) {
        setSpecs(
          config.achievements.map((a) => ({
            ...a,
            icon: ACHIEVEMENT_ICONS[a.id],
            pillar: categoryToPillar(a.category),
          })),
        );
      }
    } catch (err) {
      toast({ title: t('achievements.evaluateError'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setEvaluating(false);
    }
  }, [toast]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const byKey = new Map(records.map((a) => [a.achievement_type, a]));
  const unlockedCount = records.filter((a) => a.status !== 'revoked').length;
  const total = specs.length;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <PageHeader
        title={t('page.achievements.title')}
        subtitle={t('page.achievements.subtitle')}
      >
        <Button variant="outline" size="sm" onClick={evaluate} disabled={evaluating || loading}>
          <RefreshCw className={`h-4 w-4 ${evaluating ? 'animate-spin' : ''}`} />
          {t('page.achievements.reEvaluate')}
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <span className="font-semibold text-accent">{unlockedCount}</span>{' '}
          <span className="text-muted-foreground">
            {t('achievements.of')} {total} {t('achievements.summary')}
          </span>
        </div>

        {PILLARS.map((pillar) => {
          const pillarSpecs = specs.filter((s) => s.pillar === pillar.id);
          if (pillarSpecs.length === 0) return null;
          return (
            <section key={pillar.id}>
              <div className="mb-3">
                <h2 className="font-heading text-lg font-bold">{pillar.label}</h2>
                <p className="text-sm text-muted-foreground">{pillar.desc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {pillarSpecs.map((spec) => {
                  const rec = byKey.get(spec.id);
                  return (
                    <AchievementMedallion
                      key={spec.id}
                      spec={spec}
                      achievement={rec}
                      onClick={() => setSelected({ spec, rec })}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <ProofViewerModal
          spec={selected.spec}
          achievement={selected.rec}
          onClose={() => setSelected(null)}
        />
      )}
      <DocumentationLink slug="achievements" />
    </div>
  );
}