// SwapPulse help-page content registry.
// All 44 help pages' structured content is defined here, split into category
// files for maintainability. The translate-help-content backend function
// reads this data (via a shared copy in base44/shared/) to generate AI
// translations stored as TranslationOverride records with key 'help.<slug>'.
//
// The useHelpContent hook returns the translated version at runtime, falling
// back to the English content defined here.

import { collectionPages } from './helpContent/collection';
import { tradingPages } from './helpContent/trading';
import { socialPages } from './helpContent/social';
import { communityPages } from './helpContent/community';
import { voicePages, challengesPages, aiPages, accountPages, platformPages } from './helpContent/platform';

export const HELP_CONTENT = {
  ...collectionPages,
  ...tradingPages,
  ...socialPages,
  ...communityPages,
  ...voicePages,
  ...challengesPages,
  ...aiPages,
  ...accountPages,
  ...platformPages,
};