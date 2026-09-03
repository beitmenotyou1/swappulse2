import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Store, Tag } from 'lucide-react';
import { getPokeWalletMarket } from '@/lib/cardEnrichment';
import { useI18n } from '@/lib/i18n/I18nProvider';

const COPY = {
  en: { title: 'Market cross-check', subtitle: 'Additional live market data from PokéWallet', tcg: 'TCGPlayer', cm: 'CardMarket', market: 'Market', low: 'Low', mid: 'Mid', high: 'High', avg: 'Average', trend: 'Trend', cached: 'cached', stale: 'stale cache', source: 'Source', open: 'Open marketplace' },
  fr: { title: 'Vérification du marché', subtitle: 'Données de marché supplémentaires via PokéWallet', tcg: 'TCGPlayer', cm: 'CardMarket', market: 'Marché', low: 'Bas', mid: 'Médian', high: 'Haut', avg: 'Moyenne', trend: 'Tendance', cached: 'cache', stale: 'cache ancien', source: 'Source', open: 'Ouvrir la place de marché' },
  de: { title: 'Marktvergleich', subtitle: 'Zusätzliche Marktdaten über PokéWallet', tcg: 'TCGPlayer', cm: 'CardMarket', market: 'Markt', low: 'Niedrig', mid: 'Mittel', high: 'Hoch', avg: 'Durchschnitt', trend: 'Trend', cached: 'Cache', stale: 'veralteter Cache', source: 'Quelle', open: 'Marktplatz öffnen' },
  it: { title: 'Confronto mercato', subtitle: 'Dati di mercato aggiuntivi tramite PokéWallet', tcg: 'TCGPlayer', cm: 'CardMarket', market: 'Mercato', low: 'Minimo', mid: 'Medio', high: 'Massimo', avg: 'Media', trend: 'Tendenza', cached: 'cache', stale: 'cache non recente', source: 'Fonte', open: 'Apri marketplace' },
  es: { title: 'Comparación de mercado', subtitle: 'Datos de mercado adicionales mediante PokéWallet', tcg: 'TCGPlayer', cm: 'CardMarket', market: 'Mercado', low: 'Bajo', mid: 'Medio', high: 'Alto', avg: 'Media', trend: 'Tendencia', cached: 'caché', stale: 'caché antigua', source: 'Fuente', open: 'Abrir mercado' },
  pt: { title: 'Comparação de mercado', subtitle: 'Dados de mercado adicionais via PokéWallet', tcg: 'TCGPlayer', cm: 'CardMarket', market: 'Mercado', low: 'Baixo', mid: 'Médio', high: 'Alto', avg: 'Média', trend: 'Tendência', cached: 'cache', stale: 'cache antigo', source: 'Fonte', open: 'Abrir marketplace' },
  ja: { title: '市場クロスチェック', subtitle: 'PokéWalletによる追加市場データ', tcg: 'TCGPlayer', cm: 'CardMarket', market: '市場価格', low: '安値', mid: '中央値', high: '高値', avg: '平均', trend: 'トレンド', cached: 'キャッシュ', stale: '古いキャッシュ', source: '情報源', open: 'マーケットを開く' },
  ko: { title: '시장 교차 확인', subtitle: 'PokéWallet의 추가 시장 데이터', tcg: 'TCGPlayer', cm: 'CardMarket', market: '시장가', low: '최저', mid: '중간', high: '최고', avg: '평균', trend: '추세', cached: '캐시', stale: '오래된 캐시', source: '출처', open: '마켓 열기' },
  zh: { title: '市场交叉核对', subtitle: '来自 PokéWallet 的额外市场数据', tcg: 'TCGPlayer', cm: 'CardMarket', market: '市场价', low: '最低', mid: '中位', high: '最高', avg: '平均', trend: '趋势', cached: '缓存', stale: '旧缓存', source: '来源', open: '打开市场' },
};

function localeKey(locale) {
  const lower = String(locale || 'en').toLowerCase();
  if (lower.startsWith('ja') || lower === 'jp') return 'ja';
  if (lower.startsWith('zh')) return 'zh';
  return COPY[lower.slice(0, 2)] ? lower.slice(0, 2) : 'en';
}

function money(value, currency) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function PriceGrid({ rows, currency, labels, kind }) {
  if (!rows?.length) return null;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={`${row.variant || 'default'}-${index}`} className="rounded-xl border border-border bg-secondary/35 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold">{row.variant || 'Standard'}</span>
            {row.updatedAt && <span className="text-[10px] text-muted-foreground">{new Date(row.updatedAt).toLocaleDateString()}</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {kind === 'tcg' ? (
              <>
                <span className="text-muted-foreground">{labels.market}</span><span className="text-right font-semibold">{money(row.market, currency)}</span>
                <span className="text-muted-foreground">{labels.low}</span><span className="text-right font-semibold">{money(row.low, currency)}</span>
                <span className="text-muted-foreground">{labels.mid}</span><span className="text-right font-semibold">{money(row.mid, currency)}</span>
                <span className="text-muted-foreground">{labels.high}</span><span className="text-right font-semibold">{money(row.high, currency)}</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">{labels.avg}</span><span className="text-right font-semibold">{money(row.avg, currency)}</span>
                <span className="text-muted-foreground">{labels.low}</span><span className="text-right font-semibold">{money(row.low, currency)}</span>
                <span className="text-muted-foreground">{labels.trend}</span><span className="text-right font-semibold">{money(row.trend, currency)}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PokeWalletMarket({ card }) {
  const { locale } = useI18n();
  const labels = COPY[localeKey(locale)];
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!card?.id) return undefined;
    setLoading(true);
    getPokeWalletMarket(card.id)
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [card?.id]);

  const market = result?.matched ? result.market : null;
  const tcgUrl = useMemo(() => safeExternalUrl(market?.tcgplayer?.url), [market?.tcgplayer?.url]);
  const cmUrl = useMemo(() => safeExternalUrl(market?.cardmarket?.url), [market?.cardmarket?.url]);

  if (loading && !result) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-bold"><RefreshCw className="h-4 w-4 animate-spin text-primary" /> {labels.title}</div>
        <p className="mt-1 text-xs text-muted-foreground">{labels.subtitle}</p>
      </div>
    );
  }

  if (!market) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label={labels.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Store className="h-4 w-4 text-primary" /> {labels.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">PokéWallet</span>
          {result?.freshness?.stale && <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">{labels.stale}</span>}
          {!result?.freshness?.stale && result?.freshness?.fromCache && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{labels.cached}</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {market.tcgplayer?.prices?.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-bold"><Tag className="h-3.5 w-3.5" /> {labels.tcg} · USD</h4>
              {tcgUrl && <a href={tcgUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">{labels.open}<ExternalLink className="h-3 w-3" /></a>}
            </div>
            <PriceGrid rows={market.tcgplayer.prices} currency="USD" labels={labels} kind="tcg" />
          </div>
        )}

        {market.cardmarket?.prices?.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-bold"><Tag className="h-3.5 w-3.5" /> {labels.cm} · EUR</h4>
              {cmUrl && <a href={cmUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">{labels.open}<ExternalLink className="h-3 w-3" /></a>}
            </div>
            <PriceGrid rows={market.cardmarket.prices} currency="EUR" labels={labels} kind="cm" />
          </div>
        )}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        {labels.source}: PokéWallet → TCGPlayer / CardMarket. TCGDex remains SwapPulse’s canonical card catalogue.
      </p>
    </section>
  );
}
