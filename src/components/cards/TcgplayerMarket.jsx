import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Store } from 'lucide-react';
import { getTcgplayerMarket } from '@/lib/cardEnrichment';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { tcgplayerOutboundLink, TCGPLAYER_AFFILIATE_DISCLOSURE } from '@/lib/tcgplayerAffiliate';

const COPY = {
  en: { title: 'TCGplayer market', subtitle: 'Direct TCGplayer market-price cross-check', market: 'Market', low: 'Low', mid: 'Mid', high: 'High', buy: 'View on TCGplayer', source: 'Source', stale: 'cached fallback' },
  fr: { title: 'Marché TCGplayer', subtitle: 'Vérification directe des prix du marché TCGplayer', market: 'Marché', low: 'Bas', mid: 'Moyen', high: 'Haut', buy: 'Voir sur TCGplayer', source: 'Source', stale: 'cache de secours' },
  de: { title: 'TCGplayer-Markt', subtitle: 'Direkter TCGplayer-Preisvergleich', market: 'Markt', low: 'Niedrig', mid: 'Mittel', high: 'Hoch', buy: 'Auf TCGplayer ansehen', source: 'Quelle', stale: 'Cache-Fallback' },
  es: { title: 'Mercado TCGplayer', subtitle: 'Comparación directa del precio de mercado de TCGplayer', market: 'Mercado', low: 'Bajo', mid: 'Medio', high: 'Alto', buy: 'Ver en TCGplayer', source: 'Fuente', stale: 'caché de respaldo' },
  it: { title: 'Mercato TCGplayer', subtitle: 'Confronto diretto dei prezzi TCGplayer', market: 'Mercato', low: 'Minimo', mid: 'Medio', high: 'Massimo', buy: 'Vedi su TCGplayer', source: 'Fonte', stale: 'cache di fallback' },
  pt: { title: 'Mercado TCGplayer', subtitle: 'Comparação direta de preços do TCGplayer', market: 'Mercado', low: 'Baixo', mid: 'Médio', high: 'Alto', buy: 'Ver no TCGplayer', source: 'Fonte', stale: 'cache de contingência' },
  ja: { title: 'TCGplayer市場', subtitle: 'TCGplayer市場価格の直接比較', market: '市場価格', low: '安値', mid: '中央値', high: '高値', buy: 'TCGplayerで見る', source: '情報源', stale: 'キャッシュ代替' },
  ko: { title: 'TCGplayer 시세', subtitle: 'TCGplayer 시장 가격 직접 비교', market: '시장가', low: '최저', mid: '중간', high: '최고', buy: 'TCGplayer에서 보기', source: '출처', stale: '캐시 대체' },
  zh: { title: 'TCGplayer 市场', subtitle: '直接核对 TCGplayer 市场价格', market: '市场价', low: '最低', mid: '中间', high: '最高', buy: '在 TCGplayer 查看', source: '来源', stale: '缓存备用' },
};

function localeKey(locale) {
  const lower = String(locale || 'en').toLowerCase();
  if (lower.startsWith('ja') || lower === 'jp') return 'ja';
  if (lower.startsWith('zh')) return 'zh';
  return COPY[lower.slice(0, 2)] ? lower.slice(0, 2) : 'en';
}

function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

export default function TcgplayerMarket({ card }) {
  const { locale } = useI18n();
  const labels = COPY[localeKey(locale)];
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!card?.id) return undefined;
    setLoading(true);
    getTcgplayerMarket(card.id)
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [card?.id]);

  if (loading && !result) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Loader2 className="h-4 w-4 animate-spin text-primary" /> {labels.title}</h3>
      </section>
    );
  }

  if (!result?.matched || !result?.product) return null;
  const rows = Array.isArray(result.prices) ? result.prices : [];
  const productLink = tcgplayerOutboundLink(result.product.url);

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label={labels.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Store className="h-4 w-4 text-primary" /> {labels.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">TCGplayer</span>
          {result?.freshness?.stale && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{labels.stale}</span>}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {rows.slice(0, 8).map((row, index) => (
            <div key={`${row?.subTypeName || 'price'}-${index}`} className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="text-xs font-bold">{row?.subTypeName || 'Card'}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">{labels.market}</span><span className="text-right font-semibold">{usd(row?.marketPrice)}</span>
                <span className="text-muted-foreground">{labels.low}</span><span className="text-right">{usd(row?.lowPrice)}</span>
                <span className="text-muted-foreground">{labels.mid}</span><span className="text-right">{usd(row?.midPrice)}</span>
                <span className="text-muted-foreground">{labels.high}</span><span className="text-right">{usd(row?.highPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {productLink.url && (
        <a href={productLink.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          {labels.buy} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <p className="mt-3 text-[10px] text-muted-foreground">{labels.source}: TCGplayer. TCGDex remains SwapPulse’s canonical card catalogue. Prices are informational and may change.</p>
      <p className="mt-1 text-[10px] text-muted-foreground">This product uses TCGplayer data but is not endorsed or certified by TCGplayer.</p>
      {productLink.affiliate && <p className="mt-1 text-[10px] font-medium text-muted-foreground">{TCGPLAYER_AFFILIATE_DISCLOSURE}</p>}
    </section>
  );
}
