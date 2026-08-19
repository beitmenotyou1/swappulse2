import { useMemo } from 'react';
import { useT } from '@/lib/i18n/I18nProvider';
import { HELP_CONTENT } from '@/lib/helpContent';

// Hook for locale-aware help-page content. Returns the structured content
// for a given help-page slug, with any TranslationOverride records for the
// current language merged over the English source. Returns null if the slug
// is not found (so the page can render a loading or not-found state).
//
// The override is stored as a JSON string in TranslationOverride.value with
// key 'help.<slug>'. If present and parseable, it replaces the English content.

export function useHelpContent(slug) {
  const t = useT();

  return useMemo(() => {
    const base = HELP_CONTENT[slug];
    if (!base) return null;

    // The translation function is the merged dict from I18nProvider, which
    // includes TranslationOverride records. Help-page content is stored under
    // the key 'help.<slug>' as a JSON string. If the override exists, t()
    // returns the JSON string; otherwise it returns the key itself (meaning
    // no override), so we fall back to the English base.
    const overrideKey = `help.${slug}`;
    const overrideValue = t(overrideKey);

    if (overrideValue && overrideValue !== overrideKey) {
      try {
        const parsed = JSON.parse(overrideValue);
        // Merge: use translated title/subtitle/sections if present, fall back to base
        return {
          title: parsed.title || base.title,
          subtitle: parsed.subtitle || base.subtitle,
          sections: parsed.sections || base.sections,
          slug,
        };
      } catch {
        // If JSON parse fails, fall back to English base
        return { ...base, slug };
      }
    }

    return { ...base, slug };
  }, [slug, t]);
}