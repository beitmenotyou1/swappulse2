import { useContext, useMemo } from 'react';
import { I18nContext } from '@/lib/i18n/I18nProvider';
import { HELP_CONTENT } from '@/lib/helpContent';

// Hook to get translated help content for a given page slug.
// Returns the English content from helpContent.js if no translation
// is available in the TranslationOverride entity for the current locale.
export function useHelpContent(slug) {
  const { locale, overrides } = useContext(I18nContext);

  return useMemo(() => {
    const enContent = HELP_CONTENT[slug];
    if (!enContent) return null;

    // Check for a translated version in the overrides
    const overrideDict = overrides?.[locale];
    if (overrideDict) {
      const key = `help.${slug}`;
      const translated = overrideDict[key];
      if (translated && typeof translated === 'string' && translated.startsWith('{')) {
        try {
          const parsed = JSON.parse(translated);
          // Ensure slug is preserved
          parsed.slug = slug;
          return parsed;
        } catch {
          // Fall through to English
        }
      }
    }

    return enContent;
  }, [slug, locale, overrides]);
}

export default useHelpContent;