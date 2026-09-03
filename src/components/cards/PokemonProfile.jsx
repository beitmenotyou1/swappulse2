import React, { useEffect, useState } from 'react';
import { Activity, Dna, Loader2, Sparkles } from 'lucide-react';
import { getPokemonEnrichment } from '@/lib/cardEnrichment';
import { useI18n } from '@/lib/i18n/I18nProvider';

const COPY = {
  en: { title: 'Pokémon profile', subtitle: 'Species and game data from PokéAPI', dex: 'National Dex', generation: 'Generation', height: 'Height', weight: 'Weight', types: 'Types', abilities: 'Abilities', stats: 'Base stats', evolution: 'Evolution', legendary: 'Legendary', mythical: 'Mythical', hidden: 'hidden', stale: 'cached fallback', source: 'Source' },
  fr: { title: 'Profil Pokémon', subtitle: 'Données d’espèce et de jeu via PokéAPI', dex: 'Pokédex national', generation: 'Génération', height: 'Taille', weight: 'Poids', types: 'Types', abilities: 'Talents', stats: 'Statistiques de base', evolution: 'Évolution', legendary: 'Légendaire', mythical: 'Fabuleux', hidden: 'caché', stale: 'cache de secours', source: 'Source' },
  de: { title: 'Pokémon-Profil', subtitle: 'Arten- und Spieldaten von PokéAPI', dex: 'Nationaler Dex', generation: 'Generation', height: 'Größe', weight: 'Gewicht', types: 'Typen', abilities: 'Fähigkeiten', stats: 'Basiswerte', evolution: 'Entwicklung', legendary: 'Legendär', mythical: 'Mysteriös', hidden: 'versteckt', stale: 'Cache-Fallback', source: 'Quelle' },
  it: { title: 'Profilo Pokémon', subtitle: 'Dati su specie e giochi da PokéAPI', dex: 'Pokédex nazionale', generation: 'Generazione', height: 'Altezza', weight: 'Peso', types: 'Tipi', abilities: 'Abilità', stats: 'Statistiche base', evolution: 'Evoluzione', legendary: 'Leggendario', mythical: 'Misterioso', hidden: 'nascosta', stale: 'cache di fallback', source: 'Fonte' },
  es: { title: 'Perfil Pokémon', subtitle: 'Datos de especie y juego de PokéAPI', dex: 'Pokédex nacional', generation: 'Generación', height: 'Altura', weight: 'Peso', types: 'Tipos', abilities: 'Habilidades', stats: 'Estadísticas base', evolution: 'Evolución', legendary: 'Legendario', mythical: 'Mítico', hidden: 'oculta', stale: 'caché de respaldo', source: 'Fuente' },
  pt: { title: 'Perfil Pokémon', subtitle: 'Dados de espécie e jogo do PokéAPI', dex: 'Pokédex nacional', generation: 'Geração', height: 'Altura', weight: 'Peso', types: 'Tipos', abilities: 'Habilidades', stats: 'Estatísticas base', evolution: 'Evolução', legendary: 'Lendário', mythical: 'Mítico', hidden: 'oculta', stale: 'cache de contingência', source: 'Fonte' },
  ja: { title: 'ポケモンプロフィール', subtitle: 'PokéAPI の種族・ゲームデータ', dex: '全国図鑑', generation: '世代', height: '高さ', weight: '重さ', types: 'タイプ', abilities: '特性', stats: '種族値', evolution: '進化', legendary: '伝説', mythical: '幻', hidden: '隠れ', stale: 'キャッシュ代替', source: '情報源' },
  ko: { title: '포켓몬 프로필', subtitle: 'PokéAPI 종 및 게임 데이터', dex: '전국도감', generation: '세대', height: '키', weight: '몸무게', types: '타입', abilities: '특성', stats: '기본 능력치', evolution: '진화', legendary: '전설', mythical: '환상', hidden: '숨겨진', stale: '캐시 대체', source: '출처' },
  zh: { title: '宝可梦资料', subtitle: '来自 PokéAPI 的物种与游戏数据', dex: '全国图鉴', generation: '世代', height: '身高', weight: '体重', types: '属性', abilities: '特性', stats: '基础能力值', evolution: '进化', legendary: '传说', mythical: '幻之', hidden: '隐藏', stale: '缓存备用', source: '来源' },
};

function localeKey(locale) {
  const lower = String(locale || 'en').toLowerCase();
  if (lower.startsWith('ja') || lower === 'jp') return 'ja';
  if (lower.startsWith('zh')) return 'zh';
  return COPY[lower.slice(0, 2)] ? lower.slice(0, 2) : 'en';
}

function titleCase(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function flattenEvolution(node, depth = 0, out = []) {
  if (!node) return out;
  out.push({ id: node.id, name: titleCase(node.name), depth });
  for (const child of node.evolvesTo || []) flattenEvolution(child, depth + 1, out);
  return out;
}

function StatBar({ stat }) {
  const value = Number(stat?.base) || 0;
  const width = Math.max(3, Math.min(100, (value / 255) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{stat.name}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ProfileCard({ profile, labels }) {
  const evolution = flattenEvolution(profile.evolution);
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold">{profile.name}</h4>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">#{String(profile.dexId).padStart(4, '0')}</span>
            {profile.legendary && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">{labels.legendary}</span>}
            {profile.mythical && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{labels.mythical}</span>}
          </div>
          {profile.genus && <p className="mt-0.5 text-xs text-muted-foreground">{profile.genus}</p>}
        </div>
        {profile.freshness?.stale && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{labels.stale}</span>}
      </div>

      {profile.flavorText && <p className="mt-3 text-sm text-muted-foreground">{profile.flavorText}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div><dt className="text-muted-foreground">{labels.dex}</dt><dd className="font-semibold">#{profile.dexId}</dd></div>
        {profile.generation && <div><dt className="text-muted-foreground">{labels.generation}</dt><dd className="font-semibold">{profile.generation}</dd></div>}
        {profile.heightMetres != null && <div><dt className="text-muted-foreground">{labels.height}</dt><dd className="font-semibold">{profile.heightMetres.toFixed(1)} m</dd></div>}
        {profile.weightKg != null && <div><dt className="text-muted-foreground">{labels.weight}</dt><dd className="font-semibold">{profile.weightKg.toFixed(1)} kg</dd></div>}
      </dl>

      {profile.types?.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{labels.types}</p>
          <div className="flex flex-wrap gap-1.5">{profile.types.map((type) => <span key={type} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{type}</span>)}</div>
        </div>
      )}

      {profile.abilities?.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{labels.abilities}</p>
          <div className="flex flex-wrap gap-1.5">{profile.abilities.map((ability) => <span key={`${ability.name}-${ability.hidden}`} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{ability.name}{ability.hidden ? ` · ${labels.hidden}` : ''}</span>)}</div>
        </div>
      )}

      {profile.stats?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{labels.stats}</p>
          <div className="grid gap-2 sm:grid-cols-2">{profile.stats.map((stat) => <StatBar key={stat.name} stat={stat} />)}</div>
        </div>
      )}

      {evolution.length > 1 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{labels.evolution}</p>
          <div className="flex flex-wrap items-center gap-1 text-xs font-semibold">
            {evolution.map((step, index) => (
              <React.Fragment key={`${step.id || step.name}-${index}`}>
                {index > 0 && <span className="text-muted-foreground">→</span>}
                <span className="rounded-full bg-secondary px-2.5 py-1">{step.name}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PokemonProfile({ card }) {
  const { locale } = useI18n();
  const labels = COPY[localeKey(locale)];
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!card?.id || String(card.category || '').toLowerCase() !== 'pokemon') return undefined;
    setLoading(true);
    getPokemonEnrichment(card.id, locale)
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [card?.id, card?.category, locale]);

  if (loading && !result) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Loader2 className="h-4 w-4 animate-spin text-primary" /> {labels.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{labels.subtitle}</p>
      </section>
    );
  }

  if (!result?.available || !result?.profiles?.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label={labels.title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Dna className="h-4 w-4 text-primary" /> {labels.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> PokéAPI</div>
      </div>
      <div className="space-y-3">{result.profiles.map((profile) => <ProfileCard key={profile.dexId} profile={profile} labels={labels} />)}</div>
      <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground"><Activity className="h-3 w-3" /> {labels.source}: PokéAPI, linked by TCGDex National Pokédex ID.</p>
    </section>
  );
}
