import React, { useEffect, useMemo, useState } from 'react';
import { Award, History, Loader2, TrendingUp } from 'lucide-react';
import { getPokemonPriceTrackerMarket } from '@/lib/cardEnrichment';
import { useI18n } from '@/lib/i18n/I18nProvider';

const COPY = {
  en: { title: 'Graded & recent market', subtitle: 'RAW, graded sold-price and 3-day history cross-check', raw: 'RAW market', low: 'Low', variants: 'Condition & printing', graded: 'Graded sold prices', history: 'Recent history', sales: 'sales', preview: 'Development preview', stale: 'cached fallback', source: 'Source', noPrice: 'No price' },
  fr: { title: 'Marché récent et gradé', subtitle: 'Vérification des prix bruts, gradés et de l’historique sur 3 jours', raw: 'Marché brut', low: 'Bas', variants: 'État et impression', graded: 'Prix de ventes gradées', history: 'Historique récent', sales: 'ventes', preview: 'Aperçu de développement', stale: 'cache de secours', source: 'Source', noPrice: 'Aucun prix' },
  de: { title: 'Bewerteter & aktueller Markt', subtitle: 'RAW-, Grading-Verkaufspreise und 3-Tage-Verlauf', raw: 'RAW-Markt', low: 'Niedrig', variants: 'Zustand & Druck', graded: 'Grading-Verkaufspreise', history: 'Letzte Historie', sales: 'Verkäufe', preview: 'Entwicklungsvorschau', stale: 'Cache-Fallback', source: 'Quelle', noPrice: 'Kein Preis' },
  it: { title: 'Mercato recente e graduato', subtitle: 'Confronto prezzi RAW, graduati e cronologia di 3 giorni', raw: 'Mercato RAW', low: 'Minimo', variants: 'Condizione e stampa', graded: 'Prezzi vendite graduate', history: 'Cronologia recente', sales: 'vendite', preview: 'Anteprima sviluppo', stale: 'cache di fallback', source: 'Fonte', noPrice: 'Nessun prezzo' },
  es: { title: 'Mercado reciente y graduado', subtitle: 'Comparación RAW, ventas graduadas e historial de 3 días', raw: 'Mercado RAW', low: 'Bajo', variants: 'Condición e impresión', graded: 'Precios de ventas graduadas', history: 'Historial reciente', sales: 'ventas', preview: 'Vista de desarrollo', stale: 'caché de respaldo', source: 'Fuente', noPrice: 'Sin precio' },
  pt: { title: 'Mercado recente e graduado', subtitle: 'Comparação RAW, preços graduados e histórico de 3 dias', raw: 'Mercado RAW', low: 'Baixo', variants: 'Condição e impressão', graded: 'Preços de vendas graduadas', history: 'Histórico recente', sales: 'vendas', preview: 'Prévia de desenvolvimento', stale: 'cache de contingência', source: 'Fonte', noPrice: 'Sem preço' },
  ja: { title: '鑑定・直近市場', subtitle: 'RAW価格、鑑定済み販売価格、3日履歴の比較', raw: 'RAW市場', low: '安値', variants: '状態・印刷', graded: '鑑定済み販売価格', history: '直近履歴', sales: '件', preview: '開発プレビュー', stale: 'キャッシュ代替', source: '情報源', noPrice: '価格なし' },
  ko: { title: '등급·최근 시세', subtitle: 'RAW, 등급 판매가 및 3일 이력 교차 확인', raw: 'RAW 시세', low: '최저', variants: '상태 및 인쇄', graded: '등급 판매 가격', history: '최근 이력', sales: '판매', preview: '개발 미리보기', stale: '캐시 대체', source: '출처', noPrice: '가격 없음' },
  zh: { title: '评级与近期市场', subtitle: 'RAW、评级成交价及3日历史交叉核对', raw: 'RAW市场价', low: '最低', variants: '品相与印刷', graded: '评级成交价', history: '近期历史', sales: '成交', preview: '开发预览', stale: '缓存备用', source: '来源', noPrice: '暂无价格' },
};

function localeKey(locale) {
  const lower = String(locale || 'en').toLowerCase();
  if (lower.startsWith('ja') || lower === 'jp') return 'ja';
  if (lower.startsWith('zh')) return 'zh';
  return COPY[lower.slice(0, 2)] ? lower.slice(0, 2) : 'en';
}

function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

function gradeLabel(value) {
  return String(value || '').replace(/_/g, '.').replace(/^psa/i, 'PSA ').replace(/^cgc/i, 'CGC ').replace(/^bgs/i, 'BGS ').replace(/^sgc/i, 'SGC ').toUpperCase();
}

function historyPoints(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.slice(-3);
  const collect = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.history)) return value.history;
    return null;
  };

  for (const variant of Object.values(raw?.variants || {})) {
    for (const condition of Object.values(variant || {})) {
      const points = collect(condition);
      if (points?.length) return points.slice(-3);
    }
  }
  for (const condition of Object.values(raw?.conditions || {})) {
    const points = collect(condition);
    if (points?.length) return points.slice(-3);
  }
  return [];
}

function pointPrice(point) {
  return point?.market ?? point?.price ?? point?.marketPrice ?? point?.tcgplayer?.market ?? null;
}

export default function PokemonPriceTrackerMarket({ card }) {
  const { locale } = useI18n();
  const labels = COPY[localeKey(locale)];
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!card?.id) return undefined;
    setLoading(true);
    getPokemonPriceTrackerMarket(card.id)
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [card?.id]);

  const tracker = result?.matched ? result.card : null;
  const history = useMemo(() => historyPoints(tracker?.recentHistory), [tracker?.recentHistory]);
  const grades = useMemo(() => (tracker?.graded?.salesByGrade || [])
    .filter((row) => row.smartMarket != null || row.median != null || row.average != null)
    .sort((a, b) => {
      const order = ['psa10', 'psa9', 'psa8', 'cgc10', 'bgs10', 'sgc10'];
      const ai = order.indexOf(String(a.grade || '').toLowerCase());
      const bi = order.indexOf(String(b.grade || '').toLowerCase());
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    }).slice(0, 6), [tracker?.graded?.salesByGrade]);

  if (loading && !result) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Loader2 className="h-4 w-4 animate-spin text-primary" /> {labels.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{labels.subtitle}</p>
      </section>
    );
  }

  // Free/API production use is intentionally invisible to ordinary users. The
  // backend returns no market data before spending credits when the licence gate
  // is closed. Admin development previews still render normally.
  if (!tracker) return null;

  const market = usd(tracker?.prices?.market);
  const low = usd(tracker?.prices?.low);

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label={labels.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-primary" /> {labels.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">PokemonPriceTracker</span>
          {result?.developmentPreview && <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">{labels.preview}</span>}
          {result?.freshness?.stale && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{labels.stale}</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">{labels.raw}</p>
          <p className="mt-1 text-xl font-extrabold">{market || labels.noPrice}</p>
          {low && <p className="mt-1 text-xs text-muted-foreground">{labels.low}: <span className="font-semibold text-foreground">{low}</span></p>}
          {tracker?.prices?.primaryPrinting && <p className="mt-1 text-[10px] text-muted-foreground">{tracker.prices.primaryPrinting}</p>}
        </div>

        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold"><History className="h-3.5 w-3.5" /> {labels.history}</p>
            <div className="mt-2 space-y-1.5">
              {history.map((point, index) => (
                <div key={`${point?.date || index}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{point?.date ? new Date(point.date).toLocaleDateString() : `#${index + 1}`}</span>
                  <span className="font-semibold">{usd(pointPrice(point)) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {tracker?.prices?.variants?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{labels.variants}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {tracker.prices.variants.slice(0, 6).map((variant) => (
              <div key={variant.printing} className="rounded-xl border border-border bg-secondary/25 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{variant.printing}</span>
                  <span className="font-bold">{usd(variant.market) || '—'}</span>
                </div>
                {variant.conditionUsed && <p className="mt-1 text-[10px] text-muted-foreground">{variant.conditionUsed}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {grades.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Award className="h-3.5 w-3.5" /> {labels.graded}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {grades.map((row) => {
              const value = usd(row.smartMarket ?? row.median ?? row.average);
              return (
                <div key={row.grade} className="rounded-xl border border-border bg-secondary/25 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold">{gradeLabel(row.grade)}</span>
                    <span className="font-bold">{value || '—'}</span>
                  </div>
                  {row.count != null && <p className="mt-1 text-[10px] text-muted-foreground">{row.count} {labels.sales}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">
        {labels.source}: PokemonPriceTracker (TCGPlayer/eBay-derived market data). TCGDex remains SwapPulse’s canonical card catalogue. Prices are informational, may be delayed, and are not appraisals.
      </p>
    </section>
  );
}
