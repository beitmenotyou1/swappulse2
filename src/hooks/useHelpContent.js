import { useMemo, useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { LOCALE_TO_TCGDEX } from '@/lib/i18n/translations';
import { base44 } from '@/api/base44Client';
import { HELP_CONTENT } from '@/lib/helpContent';

// Hook for locale-aware help-page content. Returns the structured content
// for a given help-page slug, with any TranslationOverride record for the
// current language merged over the English source. Returns null if the slug
// is not found.
//
// The override is fetched on-demand for the current language (rather than
// relying on the bulk overrides loaded in I18nProvider, which may not include
// help translations when total overrides exceed the 5000-record list cap).
// This ensures the correct translation is always loaded, and the content
// updates immediately when the user switches language.

// Normalizes malformed block structures produced by older LLM translations
// that flattened { type, text } objects into ["type", "text", "value"] arrays.
function normalizeBlock(block) {
  // Already a proper object — pass through
  if (block && typeof block === 'object' && !Array.isArray(block)) {
    return block;
  }
  // Flattened array: ["p", "text", "value"] or ["steps", "items", "v1", "v2", ...]
  if (Array.isArray(block) && block.length >= 2) {
    const type = block[0];
    const field = block[1];
    const values = block.slice(2);
    if (type === 'p' && field === 'text' && values.length > 0) {
      return { type: 'p', text: values.join('') };
    }
    if ((type === 'steps' || type === 'list') && field === 'items') {
      return { type, items: values };
    }
  }
  return null;
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return section;
    if (!Array.isArray(section.blocks)) return section;
    return { ...section, blocks: section.blocks.map(normalizeBlock).filter(Boolean) };
  });
}

export function useHelpContent(slug) {
  const { locale } = useI18n();
  const [override, setOverride] = useState(null);

  // Fetch the specific help-page override for the current language on-demand.
  // English never needs an override (it's the source), so we skip the request.
  useEffect(() => {
    if (!slug) return;
    const lang = LOCALE_TO_TCGDEX[locale] || 'en';
    if (lang === 'en') {
      setOverride(null);
      return;
    }
    let cancelled = false;
    base44.entities.TranslationOverride
      .filter({ translation_key: `help.${slug}`, language: lang }, '-created_date', 1)
      .then((records) => {
        if (!cancelled) setOverride(records && records[0]?.value ? records[0].value : null);
      })
      .catch(() => {
        if (!cancelled) setOverride(null);
      });
    return () => { cancelled = true; };
  }, [slug, locale]);

  return useMemo(() => {
    const base = HELP_CONTENT[slug];
    if (!base) return null;

    if (override) {
      try {
        const parsed = JSON.parse(override);
        return {
          title: parsed.title || base.title,
          subtitle: parsed.subtitle || base.subtitle,
          sections: normalizeSections(parsed.sections || base.sections),
          slug,
        };
      } catch {
        return { ...base, slug };
      }
    }

    return { ...base, slug };
  }, [slug, override]);
}