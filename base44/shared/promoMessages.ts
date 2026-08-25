// Shared promo message pools, translated into every SwapPulse-supported
// language. Used by post-promo and post-help-promo to randomly assign a
// language to each promotional post so the bot publishes in different
// languages across runs.
//
// Links in every post get a ?lang=LOCALE query param so the site loads in the
// same language as the post text (handled by I18nProvider URL detection).
//
// {cardName}      — replaced with the featured card's localized name
// {featureName}   — replaced with the feature name (kept in English; proper noun)
// {title}         — replaced with the help article title (kept in English)
// {BUILD_STATUS}  — replaced with the current build status string (e.g. "beta")
// {SITE_BASE}     — replaced with https://swappulse.org
// {slug}          — replaced with the help article slug

export interface PromoLocale {
  locale: string;   // SwapPulse locale code (e.g. 'fr-FR')
  bcp47: string;    // BCP-47 short code for the PDS post `langs` field (e.g. 'fr')
  tcgdex: string;   // TCGDex language code for card name lookup (e.g. 'fr')
}

// The nine languages SwapPulse supports for promo posts.
export const PROMO_LOCALES: PromoLocale[] = [
  { locale: 'en-GB', bcp47: 'en', tcgdex: 'en' },
  { locale: 'fr-FR', bcp47: 'fr', tcgdex: 'fr' },
  { locale: 'de-DE', bcp47: 'de', tcgdex: 'de' },
  { locale: 'it-IT', bcp47: 'it', tcgdex: 'it' },
  { locale: 'es-ES', bcp47: 'es', tcgdex: 'es' },
  { locale: 'pt-BR', bcp47: 'pt', tcgdex: 'pt' },
  { locale: 'ja-JP', bcp47: 'ja', tcgdex: 'jp' },
  { locale: 'zh-CN', bcp47: 'zh', tcgdex: 'zh' },
  { locale: 'ko-KR', bcp47: 'ko', tcgdex: 'ko' },
];

export interface PromoMessagePools {
  // post-promo: card-focused hooks
  hooks: string[];
  // post-promo: value propositions
  valueProps: string[];
  // post-promo: feature-focused hooks
  featureHooks: string[];
  // post-promo: community pitch hooks
  communityHooks: string[];
  // post-promo: status-aware value props
  statusProps: string[];
  // post-promo: calls to action (link to SITE_BASE)
  ctas: string[];
  // post-help-promo: help article hooks
  helpHooks: string[];
  // post-help-promo: help value props
  helpValueProps: string[];
  // post-help-promo: help CTAs (link to SITE_BASE/help/{slug})
  helpCtas: string[];
}

// Real, commonly-searched Pokémon TCG community hashtags. These are universal
// across languages — collectors search for the same English tags globally — so
// they are NOT translated. Capped at 4 per post to stay readable.
export const HASHTAG_SETS = [
  '#PokemonTCG #PTCGO #PokemonCards #TCG',
  '#PokemonTCG #PullOfTheWeek #CardCollecting',
  '#PokemonTCG #PokemonCommunity #TCGTrading',
  '#PokemonTCG #ShinyHunting #PokemonCollection',
  '#PokemonTCG #PackOpening #PullOfTheWeek',
  '#PokemonTCG #TCGCommunity #CardCollector',
  '#PokemonTCG #PokemonCards #TradingCards',
  '#PokemonTCG #PTCGO #CardCollecting #PullOfTheWeek',
];

// English feature names are kept as-is in all languages (proper nouns).
export const FEATURE_POOL = [
  { name: 'Card Scanner', path: '/scan', description: 'Scan a card with your camera and identify it instantly.' },
  { name: 'Collection Tracker', path: '/collection', description: 'Track every card you own with set completion progress.' },
  { name: 'Trade Board', path: '/trades', description: 'List cards you have and want, and find matches with collectors.' },
  { name: 'Binders', path: '/binders', description: 'Build and share visual binders of your favourite cards.' },
  { name: 'Pack Openings', path: '/packs', description: 'Share your fresh pulls and see what the community is pulling.' },
  { name: 'Voice Spaces', path: '/spaces', description: 'Go live and talk Pokémon TCG with collectors in real time.' },
  { name: 'Market Watch', path: '/market', description: 'Track card prices and get alerts when cards move.' },
  { name: 'Circles', path: '/circles', description: 'Create invite-only collector groups for your favourite sets.' },
  { name: 'Meetups', path: '/meetups', description: 'Organise and attend local collector meetups.' },
  { name: 'Achievements', path: '/achievements', description: 'Earn badges for collection milestones and community participation.' },
];

const en: PromoMessagePools = {
  hooks: [
    '{cardName} is one of those cards that stops you mid-scroll.',
    'The artwork on {cardName} is genuinely something special.',
    'Been admiring {cardName} and the detail is just unreal.',
    '{cardName} is the kind of card that makes you want to build a whole binder around it.',
    'Every time I look at {cardName} I notice something new in the art.',
    '{cardName} has that artwork that just hits different.',
    '{cardName} is a card that earns its spot in any collection.',
    'The detail on {cardName} is a masterclass in TCG art.',
    '{cardName} is a card collectors keep coming back to.',
    "There's something about {cardName} that makes it stand out.",
    '{cardName} is easily one of the most striking cards in its set.',
    'The composition on {cardName} is just perfect.',
  ],
  valueProps: [
    "SwapPulse is a decentralized social network for Pokémon TCG collectors, built on the AT Protocol. It's in beta: features are still being built and refined.",
    "We're building a place where collectors can actually talk to each other. No ads, no algorithm. It's beta, so things may change as we go.",
    "Scan cards, build collections, create binders, find trades, all in one place. It's free and open-source, and we're still in beta so bear with us.",
    'Built on the AT Protocol, so your posts can show up on Bluesky too. Same account, bigger reach. Still in beta, still improving.',
    'No paywalls. No premium tiers. No selling your data. Just collectors helping collectors, and we\'re in beta, so expect rough edges.',
    "Your collection, your posts, your follows. They're yours. It's beta and we're actively building, but the vision is portable, collector-owned data.",
    'Challenges, meetups, pack parties: the card shop vibe, online. We\'re in beta so some of this is still coming together.',
    "SwapPulse is free and open-source, funded by donations. We're in beta, testing and iterating with the community.",
  ],
  featureHooks: [
    'The {featureName} on SwapPulse is one of my favourite parts of the site.',
    "Been using the {featureName} a lot lately, and it's genuinely useful.",
    'The {featureName} makes collecting so much easier.',
    "If you haven't tried the {featureName} yet, you're missing out.",
    'The {featureName} is what got me hooked on SwapPulse.',
    "SwapPulse's {featureName} is built by collectors who actually get it.",
  ],
  communityHooks: [
    'If you collect Pokémon TCG cards, SwapPulse was built for you.',
    'Pokémon TCG collectors deserve a place that\'s actually ours.',
    'Tired of scattered Discord servers and Reddit threads? SwapPulse brings it all together.',
    'SwapPulse is the social network Pokémon TCG collectors have been waiting for.',
    "Every Pokémon TCG collector should have a place to call home. That's SwapPulse.",
    "The Pokémon TCG community deserves a dedicated space. That's SwapPulse.",
  ],
  statusProps: [
    "SwapPulse is currently in {BUILD_STATUS}, and we're actively building and improving with the community.",
    "We're in {BUILD_STATUS} right now, so things are still evolving, but the core works and collectors are already using it.",
    "It's {BUILD_STATUS}, which means your feedback actually shapes what we build next.",
    'Being in {BUILD_STATUS} means rough edges, but also that you get in early and help shape the platform.',
    'SwapPulse is in {BUILD_STATUS}: free, open-source, and built by collectors, for collectors.',
  ],
  ctas: [
    'Come hang out with us: {SITE_BASE}',
    'Make a free account and say hi: {SITE_BASE}',
    'Start your collection here: {SITE_BASE}',
    "See what we're building: {SITE_BASE}",
    'Join the community: {SITE_BASE}',
    'Bring your binder: {SITE_BASE}',
  ],
  helpHooks: [
    "Wrote up a guide on {title} and it's worth a read.",
    "If you've ever wondered how {title} works, we've got you covered.",
    "New to SwapPulse? Here's how {title} works.",
    'Been getting questions about {title}, so we put together a full guide.',
    'The {title} guide is live and it walks you through everything.',
    'Quick tip: {title} is one of the features that makes SwapPulse different.',
    'We just published a deep dive on {title}.',
    "Here's everything you need to know about {title} on SwapPulse.",
  ],
  helpValueProps: [
    "SwapPulse is a decentralized social network for Pokémon TCG collectors, built on the AT Protocol. It's in beta and we're still building.",
    'No ads, no algorithm, no paywalls. Just collectors helping collectors. Free and open-source.',
    'Built on the AT Protocol, so your posts can show up on Bluesky too. Same account, bigger reach.',
    "Your collection, your posts, your follows. They're yours. Portable, collector-owned data.",
    'Scan cards, build collections, create binders, find trades, all in one place. Free and open-source.',
  ],
  helpCtas: [
    'Read the full guide: {SITE_BASE}/help/{slug}',
    'Check it out: {SITE_BASE}/help/{slug}',
    'Full guide here: {SITE_BASE}/help/{slug}',
    'Learn more: {SITE_BASE}/help/{slug}',
  ],
};

const fr: PromoMessagePools = {
  hooks: [
    '{cardName} est une de ces cartes qui vous arrête en plein scroll.',
    "L'illustration de {cardName} est vraiment quelque chose de spécial.",
    "J'admire {cardName} et les détails sont tout simplement irréels.",
    '{cardName} est le genre de carte qui vous donne envie de construire un classeur entier autour.',
    "À chaque fois que je regarde {cardName}, je remarque un nouveau détail dans l'illustration.",
    "{cardName} a cette illustration qui marque différemment.",
    '{cardName} est une carte qui mérite sa place dans n\'importe quelle collection.',
    "Le niveau de détail de {cardName} est une vraie leçon de maître dans l'art du TCG.",
    '{cardName} est une carte à laquelle les collectionneurs reviennent toujours.',
    'Il y a quelque chose dans {cardName} qui la fait vraiment ressortir.',
    '{cardName} est facilement l\'une des cartes les plus marquantes de sa série.',
    'La composition de {cardName} est tout simplement parfaite.',
  ],
  valueProps: [
    "SwapPulse est un réseau social décentralisé pour les collectionneurs de cartes Pokémon TCG, construit sur l'AT Protocol. Il est en beta : les fonctionnalités sont encore en cours de développement.",
    "Nous construisons un endroit où les collectionneurs peuvent vraiment se parler. Pas de pub, pas d'algorithme. C'est l'beta, les choses peuvent évoluer.",
    "Scannez des cartes, créez des collections, des classeurs, trouvez des échanges, tout au même endroit. C'est gratuit et open-source, et nous sommes encore en beta, alors soyez indulgents.",
    "Construit sur l'AT Protocol, donc vos posts peuvent apparaître sur Bluesky aussi. Même compte, plus grande portée. Toujours en beta, toujours en amélioration.",
    "Pas de paywall. Pas de formules premium. Pas de revente de vos données. Juste des collectionneurs qui s'entraident, et nous sommes en beta, alors attendez-vous à quelques imperfections.",
    "Votre collection, vos posts, vos abonnements. C'est le vôtre. C'est l'beta et nous construisons activement, mais la vision est claire : des données portables et appartenant aux collectionneurs.",
    "Défis, rencontres, fêtes d'ouverture : l'ambiance du magasin de cartes, en ligne. Nous sommes en beta, donc certaines choses sont encore en cours d'intégration.",
    "SwapPulse est gratuit et open-source, financé par les dons. Nous sommes en beta, en train de tester et d'itérer avec la communauté.",
  ],
  featureHooks: [
    "Le {featureName} sur SwapPulse est l'une de mes parties préférées du site.",
    "J'utilise beaucoup le {featureName} ces derniers temps, et c'est vraiment utile.",
    'Le {featureName} rend la collection tellement plus facile.',
    "Si vous n'avez pas encore essayé le {featureName}, vous passez à côté.",
    "C'est le {featureName} qui m'a accroché à SwapPulse.",
    'Le {featureName} de SwapPulse est construit par des collectionneurs qui comprennent vraiment.',
  ],
  communityHooks: [
    'Si vous collectionnez les cartes Pokémon TCG, SwapPulse a été conçu pour vous.',
    "Les collectionneurs de Pokémon TCG méritent un endroit qui soit vraiment le nôtre.",
    "Fatigué des serveurs Discord éparpillés et des fils Reddit ? SwapPulse rassemble tout ça.",
    "SwapPulse est le réseau social que les collectionneurs de Pokémon TCG attendaient.",
    'Chaque collectionneur de Pokémon TCG devrait avoir un endroit à appeler chez soi. C\'est SwapPulse.',
    "La communauté Pokémon TCG mérite un espace dédié. C'est SwapPulse.",
  ],
  statusProps: [
    "SwapPulse est actuellement en {BUILD_STATUS}, et nous construisons et améliorons activement avec la communauté.",
    "Nous sommes en {BUILD_STATUS} en ce moment, donc les choses évoluent encore, mais le cœur fonctionne et les collectionneurs l'utilisent déjà.",
    "C'est l'{BUILD_STATUS}, ce qui veut dire que vos retours façonnent réellement ce que nous construisons ensuite.",
    "Être en {BUILD_STATUS} signifie quelques imperfections, mais aussi que vous entrez tôt et aidez à façonner la plateforme.",
    'SwapPulse est en {BUILD_STATUS} : gratuit, open-source, et construit par des collectionneurs, pour des collectionneurs.',
  ],
  ctas: [
    'Venez nous rejoindre : {SITE_BASE}',
    'Créez un compte gratuit et dites bonjour : {SITE_BASE}',
    'Commencez votre collection ici : {SITE_BASE}',
    'Voyez ce que nous construisons : {SITE_BASE}',
    'Rejoignez la communauté : {SITE_BASE}',
    'Apportez votre classeur : {SITE_BASE}',
  ],
  helpHooks: [
    "J'ai rédigé un guide sur {title}, ça vaut le détour.",
    "Si vous vous êtes déjà demandé comment fonctionne {title}, c'est couvert.",
    'Nouveau sur SwapPulse ? Voici comment fonctionne {title}.',
    "J'ai eu pas mal de questions sur {title}, alors on a mis ensemble un guide complet.",
    'Le guide {title} est en ligne et vous explique tout.',
    'Petit conseil : {title} est l\'une des fonctionnalités qui distingue SwapPulse.',
    "On vient de publier une plongée approfondie sur {title}.",
    "Voici tout ce qu'il faut savoir sur {title} sur SwapPulse.",
  ],
  helpValueProps: [
    "SwapPulse est un réseau social décentralisé pour les collectionneurs de Pokémon TCG, construit sur l'AT Protocol. C'est l'beta et on construit encore.",
    'Pas de pub, pas d\'algorithme, pas de paywall. Juste des collectionneurs qui s\'entraident. Gratuit et open-source.',
    "Construit sur l'AT Protocol, donc vos posts peuvent apparaître sur Bluesky aussi. Même compte, plus grande portée.",
    "Votre collection, vos posts, vos abonnements. C'est le vôtre. Des données portables et appartenant aux collectionneurs.",
    "Scannez des cartes, créez des collections, des classeurs, trouvez des échanges, tout au même endroit. Gratuit et open-source.",
  ],
  helpCtas: [
    'Lire le guide complet : {SITE_BASE}/help/{slug}',
    'Jetez un œil : {SITE_BASE}/help/{slug}',
    'Le guide complet ici : {SITE_BASE}/help/{slug}',
    'En savoir plus : {SITE_BASE}/help/{slug}',
  ],
};

const de: PromoMessagePools = {
  hooks: [
    '{cardName} ist eine dieser Karten, die dich mitten beim Scrollen stoppen lässt.',
    'Die Illustration von {cardName} ist wirklich etwas Besonderes.',
    'Ich bewundere {cardName} und die Details sind einfach unglaublich.',
    '{cardName} ist die Art Karte, die dich einen ganzen Binder drum herum bauen lassen will.',
    'Jedes Mal, wenn ich {cardName} ansehe, entdecke ich etwas Neues in der Illustration.',
    '{cardName} hat diese Illustration, die einfach anders wirkt.',
    '{cardName} ist eine Karte, die sich ihren Platz in jeder Sammlung verdient.',
    'Das Detail bei {cardName} ist eine Meisterklasse in TCG-Kunst.',
    '{cardName} ist eine Karte, zu der Sammler immer wieder zurückkehren.',
    'Irgendetwas an {cardName} lässt sie herausstechen.',
    '{cardName} ist leicht eine der markantesten Karten ihres Sets.',
    'Die Komposition bei {cardName} ist einfach perfekt.',
  ],
  valueProps: [
    'SwapPulse ist ein dezentrales soziales Netzwerk für Pokémon-TCG-Sammler, gebaut auf dem AT Protocol. Es ist im Alpha-Stadium: Funktionen werden noch entwickelt und verfeinert.',
    'Wir bauen einen Ort, an dem Sammler wirklich miteinander reden können. Keine Werbung, kein Algorithmus. Es ist Alpha, also kann sich noch etwas ändern.',
    'Karten scannen, Sammlungen aufbauen, Binder erstellen, Tauschgeschäfte finden – alles an einem Ort. Es ist kostenlos und Open Source, und wir sind noch in der Alpha, also habt Geduld.',
    'Auf dem AT Protocol gebaut, also können deine Posts auch auf Bluesky erscheinen. Gleiches Konto, größere Reichweite. Noch im Alpha, noch in Verbesserung.',
    'Keine Paywalls. Keine Premium-Stufen. Kein Verkauf deiner Daten. Nur Sammler, die sich gegenseitig helfen, und wir sind im Alpha, also erwartet raue Kanten.',
    'Deine Sammlung, deine Posts, deine Follows. Sie gehören dir. Es ist Alpha und wir bauen aktiv, aber die Vision ist portable, sammlereigene Daten.',
    'Challenges, Meetups, Pack-Partys: das Kartenladen-Feeling, online. Wir sind im Alpha, also kommt manches noch zusammen.',
    'SwapPulse ist kostenlos und Open Source, finanziert durch Spenden. Wir sind im Alpha, testen und iterieren mit der Community.',
  ],
  featureHooks: [
    'Der {featureName} auf SwapPulse ist einer meiner Lieblingsteile der Seite.',
    'Ich nutze den {featureName} in letzter Zeit viel, und er ist wirklich nützlich.',
    'Der {featureName} macht das Sammeln viel einfacher.',
    'Wenn du den {featureName} noch nicht probiert hast, verpasst du etwas.',
    'Der {featureName} ist es, was mich an SwapPulse gehookt hat.',
    'SwapPulses {featureName} ist von Sammlern gebaut, die es wirklich verstehen.',
  ],
  communityHooks: [
    'Wenn du Pokémon-TCG-Karten sammelst, wurde SwapPulse für dich gebaut.',
    'Pokémon-TCG-Sammler verdienen einen Ort, der wirklich unser ist.',
    'Müde von verstreuten Discord-Servern und Reddit-Threads? SwapPulse bringt alles zusammen.',
    'SwapPulse ist das soziale Netzwerk, auf das Pokémon-TCG-Sammler gewartet haben.',
    'Jeder Pokémon-TCG-Sammler sollte einen Ort haben, den er Heimat nennen kann. Das ist SwapPulse.',
    'Die Pokémon-TCG-Community verdient einen eigenen Raum. Das ist SwapPulse.',
  ],
  statusProps: [
    'SwapPulse ist derzeit im {BUILD_STATUS}, und wir bauen und verbessern aktiv mit der Community.',
    'Wir sind gerade im {BUILD_STATUS}, also entwickelt sich noch alles, aber der Kern funktioniert und Sammler nutzen es bereits.',
    'Es ist {BUILD_STATUS}, was bedeutet, dass dein Feedback wirklich beeinflusst, was wir als Nächstes bauen.',
    'Im {BUILD_STATUS} zu sein bedeutet raue Kanten, aber auch, dass du früh dabei bist und die Plattform mitgestaltest.',
    'SwapPulse ist im {BUILD_STATUS}: kostenlos, Open Source, von Sammlern für Sammler gebaut.',
  ],
  ctas: [
    'Komm vorbei: {SITE_BASE}',
    'Erstell ein kostenloses Konto und sag hallo: {SITE_BASE}',
    'Starte deine Sammlung hier: {SITE_BASE}',
    'Schau, was wir bauen: {SITE_BASE}',
    'Tritt der Community bei: {SITE_BASE}',
    'Bring deinen Binder mit: {SITE_BASE}',
  ],
  helpHooks: [
    'Hab einen Guide zu {title} geschrieben – lesenswert.',
    'Wenn du dich jemals gefragt hast, wie {title} funktioniert, wir haben dich abgedeckt.',
    'Neu bei SwapPulse? So funktioniert {title}.',
    'Ich bekomme viele Fragen zu {title}, also haben wir einen vollständigen Guide zusammengestellt.',
    'Der {title}-Guide ist online und führt dich durch alles.',
    'Kleiner Tipp: {title} ist eines der Features, die SwapPulse besonders machen.',
    'Wir haben gerade ein Deep Dive zu {title} veröffentlicht.',
    'Hier ist alles, was du über {title} auf SwapPulse wissen musst.',
  ],
  helpValueProps: [
    'SwapPulse ist ein dezentrales soziales Netzwerk für Pokémon-TCG-Sammler, gebaut auf dem AT Protocol. Es ist Alpha und wir bauen noch.',
    'Keine Werbung, kein Algorithmus, keine Paywalls. Nur Sammler, die sich helfen. Kostenlos und Open Source.',
    'Auf dem AT Protocol gebaut, also können deine Posts auch auf Bluesky erscheinen. Gleiches Konto, größere Reichweite.',
    'Deine Sammlung, deine Posts, deine Follows. Sie gehören dir. Portable, sammlereigene Daten.',
    'Karten scannen, Sammlungen aufbauen, Binder erstellen, Tauschgeschäfte finden – alles an einem Ort. Kostenlos und Open Source.',
  ],
  helpCtas: [
    'Lies den ganzen Guide: {SITE_BASE}/help/{slug}',
    'Schau\'s dir an: {SITE_BASE}/help/{slug}',
    'Der ganze Guide hier: {SITE_BASE}/help/{slug}',
    'Mehr erfahren: {SITE_BASE}/help/{slug}',
  ],
};

const it: PromoMessagePools = {
  hooks: [
    '{cardName} è una di quelle carte che ti fermano mentre scrolli.',
    "L'illustrazione di {cardName} è davvero qualcosa di speciale.",
    'Ammiro {cardName} e i dettagli sono semplicemente irreale.',
    '{cardName} è il tipo di carta che ti fa venire voglia di costruire un intero binder intorno.',
    'Ogni volta che guardo {cardName} noto qualcosa di nuovo nell\'illustrazione.',
    "{cardName} ha quell'illustrazione che colpisce diversamente.",
    "{cardName} è una carta che si guadagna il suo posto in qualsiasi collezione.",
    'Il dettaglio di {cardName} è una lezione magistrale nella arte del TCG.',
    '{cardName} è una carta a cui i collezionisti continuano a tornare.',
    "C'è qualcosa in {cardName} che la fa risaltare.",
    "{cardName} è facilmente una delle carte più colpite del suo set.",
    'La composizione di {cardName} è semplicemente perfetta.',
  ],
  valueProps: [
    "SwapPulse è un social network decentralizzato per collezionisti di Pokémon TCG, costruito sull'AT Protocol. È in beta: le funzionalità sono ancora in costruzione e perfezionamento.",
    "Stiamo costruendo un posto dove i collezionisti possono davvero parlarsi. Niente pubblicità, niente algoritmo. È beta, quindi le cose possono cambiare.",
    "Scansiona carte, costruisci collezioni, crea binder, trova scambi, tutto in un posto. È gratuito e open-source, e siamo ancora in beta, quindi portate pazienza.",
    "Costruito sull'AT Protocol, quindi i tuoi post possono apparire anche su Bluesky. Stesso account, maggiore portata. Ancora in beta, ancora in miglioramento.",
    'Nessun paywall. Nessun livello premium. Nessuna vendita dei tuoi dati. Solo collezionisti che si aiutano, e siamo in beta, quindi aspettatevi qualche spigolo.',
    "La tua collezione, i tuoi post, i tuoi follow. Sono tuoi. È beta e stiamo costruendo attivamente, ma la visione è dati portabili e di proprietà dei collezionisti.",
    'Sfide, meetup, pack party: l\'atmosfera del negozio di carte, online. Siamo in beta quindi qualcosa sta ancora prendendo forma.',
    'SwapPulse è gratuito e open-source, finanziato dalle donazioni. Siamo in beta, testando e iterando con la comunità.',
  ],
  featureHooks: [
    'Il {featureName} su SwapPulse è una delle mie parti preferite del sito.',
    'Sto usando molto il {featureName} ultimamente, ed è davvero utile.',
    'Il {featureName} rende il collezionare molto più facile.',
    "Se non hai ancora provato il {featureName}, ti stai perdendo qualcosa.",
    'È il {featureName} che mi ha agganciato a SwapPulse.',
    'Il {featureName} di SwapPulse è costruito da collezionisti che capiscono davvero.',
  ],
  communityHooks: [
    'Se collezioni carte Pokémon TCG, SwapPulse è stato costruito per te.',
    'I collezionisti di Pokémon TCG meritano un posto che sia davvero nostro.',
    'Stanco di server Discord sparsi e thread Reddit? SwapPulse mette tutto insieme.',
    'SwapPulse è il social network che i collezionisti di Pokémon TCG aspettavano.',
    'Ogni collezionista di Pokémon TCG dovrebbe avere un posto da chiamare casa. Quello è SwapPulse.',
    'La comunità di Pokémon TCG merita uno spazio dedicato. Quello è SwapPulse.',
  ],
  statusProps: [
    'SwapPulse è attualmente in {BUILD_STATUS}, e stiamo costruendo e migliorando attivamente con la comunità.',
    "Siamo in {BUILD_STATUS} in questo momento, quindi le cose stanno ancora evolvendo, ma il nucleo funziona e i collezionisti lo usano già.",
    'È {BUILD_STATUS}, il che significa che il tuo feedback modella davvero ciò che costruiamo dopo.',
    'Essere in {BUILD_STATUS} significa qualche spigolo, ma anche che entri presto e aiuti a plasmare la piattaforma.',
    'SwapPulse è in {BUILD_STATUS}: gratuito, open-source, e costruito da collezionisti, per collezionisti.',
  ],
  ctas: [
    'Vieni a trovarci: {SITE_BASE}',
    'Crea un account gratuito e saluta: {SITE_BASE}',
    'Inizia la tua collezione qui: {SITE_BASE}',
    'Guarda cosa stiamo costruendo: {SITE_BASE}',
    'Unisciti alla comunità: {SITE_BASE}',
    'Porta il tuo binder: {SITE_BASE}',
  ],
  helpHooks: [
    'Ho scritto una guida su {title}, merita una lettura.',
    'Se ti sei mai chiesto come funziona {title}, ci pensiamo noi.',
    'Nuovo su SwapPulse? Ecco come funziona {title}.',
    'Ho ricevuto molte domande su {title}, quindi abbiamo messo insieme una guida completa.',
    'La guida {title} è online e ti porta attraverso tutto.',
    'Piccolo consiglio: {title} è una delle funzionalità che rende SwapPulse diverso.',
    'Abbiamo appena pubblicato un approfondimento su {title}.',
    'Ecco tutto quello che devi sapere su {title} su SwapPulse.',
  ],
  helpValueProps: [
    "SwapPulse è un social network decentralizzato per collezionisti di Pokémon TCG, costruito sull'AT Protocol. È beta e stiamo ancora costruendo.",
    'Niente pubblicità, niente algoritmo, niente paywall. Solo collezionisti che si aiutano. Gratuito e open-source.',
    "Costruito sull'AT Protocol, quindi i tuoi post possono apparire anche su Bluesky. Stesso account, maggiore portata.",
    'La tua collezione, i tuoi post, i tuoi follow. Sono tuoi. Dati portabili e di proprietà dei collezionisti.',
    'Scansiona carte, costruisci collezioni, crea binder, trova scambi, tutto in un posto. Gratuito e open-source.',
  ],
  helpCtas: [
    'Leggi la guida completa: {SITE_BASE}/help/{slug}',
    'Dai un\'occhiata: {SITE_BASE}/help/{slug}',
    'Guida completa qui: {SITE_BASE}/help/{slug}',
    'Scopri di più: {SITE_BASE}/help/{slug}',
  ],
};

const es: PromoMessagePools = {
  hooks: [
    '{cardName} es una de esas cartas que te detienen mientras haces scroll.',
    'La ilustración de {cardName} es realmente algo especial.',
    'He estado admirando {cardName} y el detalle es simplemente irreal.',
    '{cardName} es el tipo de carta que te hace querer construir todo un álbum alrededor.',
    'Cada vez que miro {cardName} noto algo nuevo en la ilustración.',
    '{cardName} tiene esa ilustración que simplemente impacta diferente.',
    '{cardName} es una carta que se gana su sitio en cualquier colección.',
    'El detalle de {cardName} es una clase magistral en el arte del TCG.',
    '{cardName} es una carta a la que los coleccionistas vuelven una y otra vez.',
    'Hay algo en {cardName} que la hace destacar.',
    '{cardName} es fácilmente una de las cartas más impactantes de su set.',
    'La composición de {cardName} es simplemente perfecta.',
  ],
  valueProps: [
    'SwapPulse es una red social descentralizada para coleccionistas de Pokémon TCG, construida sobre el AT Protocol. Está en beta: las funciones aún se están construyendo y perfeccionando.',
    'Estamos construyendo un lugar donde los coleccionistas puedan hablar entre ellos. Sin anuncios, sin algoritmo. Es beta, así que las cosas pueden cambiar.',
    'Escanea cartas, crea colecciones, crea álbumes, encuentra intercambios, todo en un lugar. Es gratis y de código abierto, y todavía estamos en beta, así que ten paciencia.',
    'Construido sobre el AT Protocol, así que tus publicaciones pueden aparecer en Bluesky también. Misma cuenta, mayor alcance. Todavía en beta, todavía mejorando.',
    'Sin barreras de pago. Sin niveles premium. Sin vender tus datos. Solo coleccionistas ayudando a coleccionistas, y estamos en beta, así que espera algunas asperezas.',
    'Tu colección, tus publicaciones, tus seguidores. Son tuyos. Es beta y estamos construyendo activamente, pero la visión son datos portables y de los coleccionistas.',
    'Retos, quedadas, fiestas de sobres: el ambiente de la tienda de cartas, en línea. Estamos en beta así que algo aún está tomando forma.',
    'SwapPulse es gratis y de código abierto, financiado por donaciones. Estamos en beta, probando e iterando con la comunidad.',
  ],
  featureHooks: [
    'El {featureName} en SwapPulse es una de mis partes favoritas del sitio.',
    'He estado usando mucho el {featureName} últimamente, y es realmente útil.',
    'El {featureName} hace que coleccionar sea mucho más fácil.',
    'Si aún no has probado el {featureName}, te estás perdiendo algo.',
    'El {featureName} fue lo que me enganchó a SwapPulse.',
    'El {featureName} de SwapPulse está construido por coleccionistas que realmente lo entienden.',
  ],
  communityHooks: [
    'Si coleccionas cartas Pokémon TCG, SwapPulse fue hecho para ti.',
    'Los coleccionistas de Pokémon TCG merecemos un lugar que sea realmente nuestro.',
    '¿Cansado de servidores de Discord dispersos e hilos de Reddit? SwapPulse lo une todo.',
    'SwapPulse es la red social que los coleccionistas de Pokémon TCG estaban esperando.',
    'Cada coleccionista de Pokémon TCG debería tener un lugar al que llamar hogar. Ese es SwapPulse.',
    'La comunidad de Pokémon TCG merece un espacio dedicado. Ese es SwapPulse.',
  ],
  statusProps: [
    'SwapPulse está actualmente en {BUILD_STATUS}, y estamos construyendo y mejorando activamente con la comunidad.',
    'Estamos en {BUILD_STATUS} ahora mismo, así que las cosas siguen evolucionando, pero el núcleo funciona y los coleccionistas ya lo usan.',
    'Es {BUILD_STATUS}, lo que significa que tu feedback realmente da forma a lo que construimos después.',
    'Estar en {BUILD_STATUS} significa algunas asperezas, pero también que entras pronto y ayudas a dar forma a la plataforma.',
    'SwapPulse está en {BUILD_STATUS}: gratis, de código abierto, y construido por coleccionistas, para coleccionistas.',
  ],
  ctas: [
    'Ven a pasar el rato con nosotros: {SITE_BASE}',
    'Crea una cuenta gratis y saluda: {SITE_BASE}',
    'Empieza tu colección aquí: {SITE_BASE}',
    'Mira lo que estamos construyendo: {SITE_BASE}',
    'Únete a la comunidad: {SITE_BASE}',
    'Trae tu álbum: {SITE_BASE}',
  ],
  helpHooks: [
    'Escribí una guía sobre {title}, vale la pena leerla.',
    'Si alguna vez te has preguntado cómo funciona {title}, te lo contamos.',
    '¿Nuevo en SwapPulse? Así es como funciona {title}.',
    'He recibido preguntas sobre {title}, así que preparamos una guía completa.',
    'La guía de {title} está disponible y te lleva paso a paso.',
    'Consejo rápido: {title} es una de las funciones que hace que SwapPulse sea diferente.',
    'Acabamos de publicar un análisis profundo sobre {title}.',
    'Aquí tienes todo lo que necesitas saber sobre {title} en SwapPulse.',
  ],
  helpValueProps: [
    'SwapPulse es una red social descentralizada para coleccionistas de Pokémon TCG, construida sobre el AT Protocol. Está en beta y seguimos construyendo.',
    'Sin anuncios, sin algoritmo, sin barreras de pago. Solo coleccionistas ayudando a coleccionistas. Gratis y de código abierto.',
    'Construido sobre el AT Protocol, así que tus publicaciones pueden aparecer en Bluesky también. Misma cuenta, mayor alcance.',
    'Tu colección, tus publicaciones, tus seguidores. Son tuyos. Datos portables y de los coleccionistas.',
    'Escanea cartas, crea colecciones, crea álbumes, encuentra intercambios, todo en un lugar. Gratis y de código abierto.',
  ],
  helpCtas: [
    'Lee la guía completa: {SITE_BASE}/help/{slug}',
    'Échale un vistazo: {SITE_BASE}/help/{slug}',
    'Guía completa aquí: {SITE_BASE}/help/{slug}',
    'Saber más: {SITE_BASE}/help/{slug}',
  ],
};

const pt: PromoMessagePools = {
  hooks: [
    '{cardName} é uma daquelas cartas que te param enquanto navega.',
    'A arte de {cardName} é realmente algo especial.',
    'Tenho admirado {cardName} e os detalhes são simplesmente irreais.',
    '{cardName} é o tipo de carta que te faz querer montar uma pasta inteira em torno dela.',
    'Toda vez que olho para {cardName} noto algo novo na arte.',
    '{cardName} tem aquela arte que simplesmente impacta de forma diferente.',
    '{cardName} é uma carta que ganha seu lugar em qualquer coleção.',
    'O detalhe de {cardName} é uma aula magna na arte do TCG.',
    '{cardName} é uma carta à qual os colecionadores voltam sempre.',
    'Tem algo em {cardName} que a faz destacar.',
    '{cardName} é facilmente uma das cartas mais marcantes do seu set.',
    'A composição de {cardName} é simplesmente perfeita.',
  ],
  valueProps: [
    'SwapPulse é uma rede social descentralizada para colecionadores de Pokémon TCG, construída sobre o AT Protocol. Está em beta: os recursos ainda estão sendo construídos e refinados.',
    'Estamos construindo um lugar onde os colecionadores possam realmente conversar. Sem anúncios, sem algoritmo. É beta, então as coisas podem mudar.',
    'Escanear cartas, montar coleções, criar pastas, encontrar trocas, tudo num só lugar. É grátis e open-source, e ainda estamos em beta, então tenham paciência.',
    'Construído sobre o AT Protocol, então seus posts podem aparecer no Bluesky também. Mesma conta, maior alcance. Ainda em beta, ainda melhorando.',
    'Sem paywalls. Sem níveis premium. Sem vender seus dados. Só colecionadores se ajudando, e estamos em beta, então espere algumas arestas.',
    'Sua coleção, seus posts, seus seguidores. São seus. É beta e estamos construindo ativamente, mas a visão são dados portáteis e de propriedade dos colecionadores.',
    'Desafios, encontros, festas de pacote: a vibe da loja de cartas, online. Estamos em beta então algo ainda está se juntando.',
    'SwapPulse é grátis e open-source, financiado por doações. Estamos em beta, testando e iterando com a comunidade.',
  ],
  featureHooks: [
    'O {featureName} no SwapPulse é uma das minhas partes favoritas do site.',
    'Tenho usado muito o {featureName} ultimamente, e é realmente útil.',
    'O {featureName} torna colecionar muito mais fácil.',
    'Se você ainda não tentou o {featureName}, está perdendo algo.',
    'O {featureName} foi o que me viciou no SwapPulse.',
    'O {featureName} do SwapPulse é construído por colecionadores que realmente entendem.',
  ],
  communityHooks: [
    'Se você coleciona cartas Pokémon TCG, SwapPulse foi feito para você.',
    'Os colecionadores de Pokémon TCG merecem um lugar que seja realmente nosso.',
    'Cansado de servidores Discord espalhados e threads no Reddit? SwapPulse junta tudo.',
    'SwapPulse é a rede social que os colecionadores de Pokémon TCG estavam esperando.',
    'Todo colecionador de Pokémon TCG deveria ter um lugar para chamar de lar. Esse é SwapPulse.',
    'A comunidade de Pokémon TCG merece um espaço dedicado. Esse é SwapPulse.',
  ],
  statusProps: [
    'SwapPulse está atualmente em {BUILD_STATUS}, e estamos construindo e melhorando ativamente com a comunidade.',
    'Estamos em {BUILD_STATUS} agora, então as coisas ainda estão evoluindo, mas o núcleo funciona e os colecionadores já estão usando.',
    'É {BUILD_STATUS}, o que significa que seu feedback realmente molda o que construímos a seguir.',
    'Estar em {BUILD_STATUS} significa algumas arestas, mas também que você entra cedo e ajuda a moldar a plataforma.',
    'SwapPulse está em {BUILD_STATUS}: grátis, open-source, e construído por colecionadores, para colecionadores.',
  ],
  ctas: [
    'Venha passar o tempo com a gente: {SITE_BASE}',
    'Crie uma conta grátis e diga oi: {SITE_BASE}',
    'Comece sua coleção aqui: {SITE_BASE}',
    'Veja o que estamos construindo: {SITE_BASE}',
    'Junte-se à comunidade: {SITE_BASE}',
    'Traga sua pasta: {SITE_BASE}',
  ],
  helpHooks: [
    'Escrevi um guia sobre {title}, vale a pena ler.',
    'Se você já se perguntou como {title} funciona, a gente cobre.',
    'Novo no SwapPulse? Veja como {title} funciona.',
    'Tenho recebido perguntas sobre {title}, então preparamos um guia completo.',
    'O guia de {title} está no ar e te leva por tudo.',
    'Dica rápida: {title} é um dos recursos que torna SwapPulse diferente.',
    'Acabamos de publicar um mergulho profundo sobre {title}.',
    'Aqui está tudo o que você precisa saber sobre {title} no SwapPulse.',
  ],
  helpValueProps: [
    'SwapPulse é uma rede social descentralizada para colecionadores de Pokémon TCG, construída sobre o AT Protocol. É beta e ainda estamos construindo.',
    'Sem anúncios, sem algoritmo, sem paywalls. Só colecionadores se ajudando. Grátis e open-source.',
    'Construído sobre o AT Protocol, então seus posts podem aparecer no Bluesky também. Mesma conta, maior alcance.',
    'Sua coleção, seus posts, seus seguidores. São seus. Dados portáteis e de propriedade dos colecionadores.',
    'Escanear cartas, montar coleções, criar pastas, encontrar trocas, tudo num só lugar. Grátis e open-source.',
  ],
  helpCtas: [
    'Leia o guia completo: {SITE_BASE}/help/{slug}',
    'Dê uma olhada: {SITE_BASE}/help/{slug}',
    'Guia completo aqui: {SITE_BASE}/help/{slug}',
    'Saiba mais: {SITE_BASE}/help/{slug}',
  ],
};

const ja: PromoMessagePools = {
  hooks: [
    '{cardName}は、スクロール中に思わず足を止めるカードの一枚です。',
    '{cardName}のイラストは本当に特別な何かがあります。',
    '{cardName}をずっと見惚れていますが、そのディテールは本当に圧巻です。',
    '{cardName}は、まるまる一冊のバインダーを組みたくなるようなカードです。',
    '{cardName}を見るたびに、イラストの新しい発見があります。',
    '{cardName}のイラストは、何か違うものを感じさせます。',
    '{cardName}は、どんなコレクションでもその居場所を勝ち取るカードです。',
    '{cardName}のディテールは、TCGアートの見事な手本です。',
    '{cardName}は、コレクターが何度も戻ってくるカードです。',
    '{cardName}には、際立たせる何かがあります。',
    '{cardName}は、間違いなくそのセットで最も目を引くカードの一枚です。',
    '{cardName}の構図は、まさに完璧です。',
  ],
  valueProps: [
    'SwapPulseは、AT Protocol上に構築された、ポケモンTCGコレクター向けの分散型ソーシャルネットワークです。現在ベータ版で、機能はまだ構築・改良中です。',
    'コレクター同士が実際に語り合える場所を作っています。広告なし、アルゴリズムなし。ベータ版なので、変化があるかもしれません。',
    'カードをスキャン、コレクション構築、バインダー作成、トレード発見、すべて一つの場所で。無料でオープンソース、まだベータ版なのでご容赦ください。',
    'AT Protocol上に構築されているので、あなたの投稿はBlueskyにも表示できます。同じアカウントで、より大きなリーチ。まだベータ版、まだ改良中。',
    '課金壁なし。プレミアム階層なし。データ販売なし。ただコレクター同士が助け合うだけ。ベータ版なので、荒い部分もあるかもしれません。',
    'あなたのコレクション、投稿、フォロー。それはあなたのものです。ベータ版で積極的に構築中ですが、ビジョンはポータブルでコレクター所有のデータです。',
    'チャレンジ、ミートアップ、パックパーティー。カードショップの雰囲気をオンラインで。ベータ版なので、まだまとまっている部分もあります。',
    'SwapPulseは無料でオープンソース、寄付で運営されています。ベータ版で、コミュニティと共にテストと反復を重ねています。',
  ],
  featureHooks: [
    'SwapPulseの{featureName}は、私のお気に入りの機能の一つです。',
    '最近{featureName}をよく使っていますが、本当に便利です。',
    '{featureName}のおかげでコレクション作りがずっと楽になりました。',
    'まだ{featureName}を試していないなら、もったいないです。',
    '私をSwapPulseに夢中にさせたのは{featureName}です。',
    'SwapPulseの{featureName}は、本当に理解しているコレクターによって作られています。',
  ],
  communityHooks: [
    'ポケモンTCGカードを集めているなら、SwapPulseはあなたのために作られました。',
    'ポケモンTCGコレクターには、本当に自分たちの場所がふさわしいです。',
    '散らばったDiscordサーバーやRedditスレッドに疲れていませんか？SwapPulseがすべてを一つに。',
    'SwapPulseは、ポケモンTCGコレクターが待ち望んでいたソーシャルネットワークです。',
    'すべてのポケモンTCGコレクターに家と呼べる場所があるべきです。それがSwapPulseです。',
    'ポケモンTCGコミュニティには専用の場所がふさわしい。それがSwapPulseです。',
  ],
  statusProps: [
    'SwapPulseは現在{BUILD_STATUS}で、コミュニティと共に積極的に構築・改善しています。',
    '現在{BUILD_STATUS}なので、まだ進化中ですが、コアは機能し、コレクターは既に使っています。',
    '{BUILD_STATUS}ということは、あなたのフィードバックが次に作るものを実際に形作るということです。',
    '{BUILD_STATUS}であることは、少しの荒さを意味しますが、早期に参加してプラットフォームを形作れることでもあります。',
    'SwapPulseは{BUILD_STATUS}：無料、オープンソース、コレクターによるコレクターのためのものです。',
  ],
  ctas: [
    '一緒に遊びに来てください：{SITE_BASE}',
    '無料アカウントを作って挨拶しましょう：{SITE_BASE}',
    'ここからコレクションを始めよう：{SITE_BASE}',
    '私たちが作っているものを見てください：{SITE_BASE}',
    'コミュニティに参加しよう：{SITE_BASE}',
    'バインダーを持って来よう：{SITE_BASE}',
  ],
  helpHooks: [
    '{title}についてのガイドを書きました、一読の価値があります。',
    '{title}がどう動くか気になったことがあるなら、カバーしています。',
    'SwapPulse初心者ですか？{title}の使い方はこちら。',
    '{title}について質問を受けていたので、完全なガイドを作りました。',
    '{title}のガイドが公開され、すべてを順を追って説明します。',
    'ちょっとしたヒント：{title}はSwapPulseを違うものにする機能の一つです。',
    '{title}の深掘りを公開しました。',
    'SwapPulseの{title}について知っておくべきことはこちらです。',
  ],
  helpValueProps: [
    'SwapPulseはAT Protocol上に構築された、ポケモンTCGコレクター向けの分散型ソーシャルネットワークです。ベータ版で、まだ構築中です。',
    '広告なし、アルゴリズムなし、課金壁なし。ただコレクター同士が助け合うだけ。無料でオープンソース。',
    'AT Protocol上に構築されているので、あなたの投稿はBlueskyにも表示できます。同じアカウントで、より大きなリーチ。',
    'あなたのコレクション、投稿、フォロー。それはあなたのもの。ポータブルでコレクター所有のデータ。',
    'カードをスキャン、コレクション構築、バインダー作成、トレード発見、すべて一つの場所で。無料でオープンソース。',
  ],
  helpCtas: [
    '完全なガイドを読む：{SITE_BASE}/help/{slug}',
    'チェックしてみよう：{SITE_BASE}/help/{slug}',
    '完全なガイドはこちら：{SITE_BASE}/help/{slug}',
    'もっと詳しく：{SITE_BASE}/help/{slug}',
  ],
};

const zh: PromoMessagePools = {
  hooks: [
    '{cardName}是那种让你刷到时忍不住停下来的卡。',
    '{cardName}的插画确实有特别之处。',
    '一直在欣赏{cardName}，细节真的太不真实了。',
    '{cardName}是那种让你想围绕它做一整本活页夹的卡。',
    '每次看{cardName}，我都能在插画里发现新的细节。',
    '{cardName}的插画就是有不一样的感觉。',
    '{cardName}是一张在任何收藏中都配得上自己位置的卡。',
    '{cardName}的细节是TCG艺术的大师级作品。',
    '{cardName}是收藏家们不断回头的卡。',
    '{cardName}有某种让它脱颖而出的东西。',
    '{cardName}轻松是它所在系列中最引人注目的卡之一。',
    '{cardName}的构图简直完美。',
  ],
  valueProps: [
    'SwapPulse是一个为宝可梦TCG收藏家打造的去中心化社交网络，基于AT Protocol构建。目前处于beta阶段：功能仍在开发和优化中。',
    '我们正在打造一个收藏家可以真正互相交流的地方。没有广告，没有算法。这是beta，所以可能会有变化。',
    '扫描卡牌、建立收藏、创建活页夹、寻找交易，全在一个地方。免费且开源，我们还在beta阶段，请多多包涵。',
    '基于AT Protocol构建，所以你的帖子也可以显示在Bluesky上。同一个账号，更大的触达。仍在beta，仍在改进。',
    '没有付费墙。没有高级等级。不卖你的数据。只是收藏家互相帮助，我们在beta阶段，所以会有粗糙的地方。',
    '你的收藏、你的帖子、你的关注。它们是你的。这是beta，我们在积极开发，但愿景是可移植的、收藏家拥有的数据。',
    '挑战、聚会、开包派对：卡牌店的氛围，在线上。我们在beta阶段，所以有些还在整合中。',
    'SwapPulse免费且开源，靠捐赠运营。我们在beta阶段，与社区一起测试和迭代。',
  ],
  featureHooks: [
    'SwapPulse上的{featureName}是我最喜欢的网站部分之一。',
    '最近经常用{featureName}，真的很有用。',
    '{featureName}让收藏变得容易多了。',
    '如果你还没试过{featureName}，你错过了一些东西。',
    '是{featureName}让我迷上了SwapPulse。',
    'SwapPulse的{featureName}是由真正懂行的收藏家构建的。',
  ],
  communityHooks: [
    '如果你收藏宝可梦TCG卡牌，SwapPulse就是为你打造的。',
    '宝可梦TCG收藏家值得拥有一个真正属于我们自己的地方。',
    '厌倦了分散的Discord服务器和Reddit帖子？SwapPulse把它们全部集合在一起。',
    'SwapPulse是宝可梦TCG收藏家一直在等待的社交网络。',
    '每个宝可梦TCG收藏家都应该有一个可以称之为家的地方。那就是SwapPulse。',
    '宝可梦TCG社区值得拥有一个专属空间。那就是SwapPulse。',
  ],
  statusProps: [
    'SwapPulse目前处于{BUILD_STATUS}阶段，我们正在与社区一起积极开发和改进。',
    '我们目前处于{BUILD_STATUS}阶段，所以一切还在演进，但核心功能已经可用，收藏家们已经在使用了。',
    '这是{BUILD_STATUS}，意味着你的反馈真正塑造我们接下来构建的东西。',
    '处于{BUILD_STATUS}意味着会有粗糙的地方，但也意味着你早早加入并帮助塑造平台。',
    'SwapPulse处于{BUILD_STATUS}阶段：免费、开源，由收藏家为收藏家构建。',
  ],
  ctas: [
    '来和我们一起玩：{SITE_BASE}',
    '创建一个免费账号打个招呼：{SITE_BASE}',
    '在这里开始你的收藏：{SITE_BASE}',
    '看看我们在构建什么：{SITE_BASE}',
    '加入社区：{SITE_BASE}',
    '带上你的活页夹：{SITE_BASE}',
  ],
  helpHooks: [
    '写了一篇关于{title}的指南，值得一读。',
    '如果你曾经好奇{title}是怎么运作的，我们为你解答。',
    'SwapPulse新手？这是{title}的使用方法。',
    '一直收到关于{title}的问题，所以我们做了一个完整指南。',
    '{title}的指南已上线，带你了解一切。',
    '小提示：{title}是让SwapPulse与众不同的功能之一。',
    '我们刚刚发布了关于{title}的深度解析。',
    '这是你在SwapPulse上需要了解的关于{title}的一切。',
  ],
  helpValueProps: [
    'SwapPulse是一个为宝可梦TCG收藏家打造的去中心化社交网络，基于AT Protocol构建。目前是beta阶段，我们还在开发。',
    '没有广告、没有算法、没有付费墙。只是收藏家互相帮助。免费且开源。',
    '基于AT Protocol构建，所以你的帖子也可以显示在Bluesky上。同一个账号，更大的触达。',
    '你的收藏、你的帖子、你的关注。它们是你的。可移植的、收藏家拥有的数据。',
    '扫描卡牌、建立收藏、创建活页夹、寻找交易，全在一个地方。免费且开源。',
  ],
  helpCtas: [
    '阅读完整指南：{SITE_BASE}/help/{slug}',
    '看看吧：{SITE_BASE}/help/{slug}',
    '完整指南在这里：{SITE_BASE}/help/{slug}',
    '了解更多：{SITE_BASE}/help/{slug}',
  ],
};

const ko: PromoMessagePools = {
  hooks: [
    '{cardName}은(는) 스크롤하다 멈추게 만드는 카드입니다.',
    '{cardName}의 일러스트는 정말 특별한 무엇이 있습니다.',
    '{cardName}을(를) 감상하고 있는데 디테일이 정말 압권입니다.',
    '{cardName}은(는) 그 카드 주변으로 바인더를 통째로 만들고 싶게 하는 카드입니다.',
    '{cardName}을(를) 볼 때마다 일러스트에서 새로운 것을 발견합니다.',
    '{cardName}은(는) 그냥 다르게 느껴지는 일러스트를 가지고 있습니다.',
    '{cardName}은(는) 어떤 컬렉션에서든 자리를 차지할 자격이 있는 카드입니다.',
    '{cardName}의 디테일은 TCG 아트의 대가의 수업입니다.',
    '{cardName}은(는) 컬렉터들이 계속 돌아보는 카드입니다.',
    '{cardName}에는 돋보이게 만드는 무언가가 있습니다.',
    '{cardName}은(는) 그 세트에서 가장 눈에 띄는 카드 중 하나입니다.',
    '{cardName}의 구도는 그냥 완벽합니다.',
  ],
  valueProps: [
    'SwapPulse는 AT Protocol 위에 구축된 포켓몬 TCG 컬렉터를 위한 탈중앙화 소셜 네트워크입니다. 현재 베타 단계이며 기능은 여전히 구축 및 개선 중입니다.',
    '컬렉터들이 실제로 대화할 수 있는 곳을 만들고 있습니다. 광고 없음, 알고리즘 없음. 베타 단계이므로 변화가 있을 수 있습니다.',
    '카드 스캔, 컬렉션 구축, 바인더 만들기, 트레이드 찾기, 모두 한 곳에서. 무료이고 오픈소스이며, 아직 베타 단계이니 너그럽게 봐주세요.',
    'AT Protocol 위에 구축되어, 게시물이 Bluesky에도 표시될 수 있습니다. 같은 계정, 더 큰 도달. 여전히 베타, 여전히 개선 중.',
    '페이월 없음. 프리미엄 등급 없음. 데이터 판매 없음. 컬렉터들이 서로 돕는 것뿐, 그리고 우리는 베타 단계이므로 거친 부분이 있을 수 있습니다.',
    '당신의 컬렉션, 게시물, 팔로우. 그것은 당신의 것입니다. 베타 단계이고 우리는 활발히 구축 중이지만, 비전은 휴대 가능하고 컬렉터 소유의 데이터입니다.',
    '챌린지, 밋업, 팩 파티: 카드샵의 분위기를 온라인으로. 우리는 베타 단계이므로 일부는 아직 정리 중입니다.',
    'SwapPulse는 무료이고 오픈소스이며, 기부로 운영됩니다. 우리는 베타 단계에서 커뮤니티와 함께 테스트하고 반복하고 있습니다.',
  ],
  featureHooks: [
    'SwapPulse의 {featureName}은(는) 사이트에서 가장 좋아하는 부분 중 하나입니다.',
    '최근 {featureName}을(를) 많이 사용하고 있는데, 정말 유용합니다.',
    '{featureName} 덕분에 컬렉팅이 훨씬 쉬워졌습니다.',
    '아직 {featureName}을(를) 안 해보셨다면, 손해 보는 중입니다.',
    '저를 SwapPulse에 푹 빠지게 만든 것은 {featureName}입니다.',
    'SwapPulse의 {featureName}은(는) 정말 이해하는 컬렉터가 만들었습니다.',
  ],
  communityHooks: [
    '포켓몬 TCG 카드를 수집한다면, SwapPulse는 당신을 위해 만들어졌습니다.',
    '포켓몬 TCG 컬렉터는 정말 우리의 공간을 가질 자격이 있습니다.',
    '흩어진 Discord 서버와 Reddit 스레드에 지치셨나요? SwapPulse가 모두 모읍니다.',
    'SwapPulse는 포켓몬 TCG 컬렉터가 기다려온 소셜 네트워크입니다.',
    '모든 포켓몬 TCG 컬렉터는 집이라 부를 곳이 있어야 합니다. 그곳이 SwapPulse입니다.',
    '포켓몬 TCG 커뮤니티는 전용 공간을 가질 자격이 있습니다. 그곳이 SwapPulse입니다.',
  ],
  statusProps: [
    'SwapPulse는 현재 {BUILD_STATUS} 단계이며, 커뮤니티와 함께 활발히 구축하고 개선하고 있습니다.',
    '현재 {BUILD_STATUS} 단계이므로 아직 진화 중이지만, 핵심은 작동하고 컬렉터들이 이미 사용 중입니다.',
    '{BUILD_STATUS}라는 것은, 당신의 피드백이 우리가 다음에 만들 것을 실제로 형성한다는 뜻입니다.',
    '{BUILD_STATUS} 단계라는 것은 약간의 거친 부분이 있다는 뜻이지만, 일찍 들어와서 플랫폼을 형성할 수 있다는 뜻이기도 합니다.',
    'SwapPulse는 {BUILD_STATUS} 단계입니다: 무료, 오픈소스, 컬렉터에 의한 컬렉터를 위한 것입니다.',
  ],
  ctas: [
    '함께 놀러 오세요: {SITE_BASE}',
    '무료 계정을 만들고 인사하세요: {SITE_BASE}',
    '여기서 컬렉션을 시작하세요: {SITE_BASE}',
    '우리가 만들고 있는 것을 보세요: {SITE_BASE}',
    '커뮤니티에 참여하세요: {SITE_BASE}',
    '바인더를 가져오세요: {SITE_BASE}',
  ],
  helpHooks: [
    '{title}에 대한 가이드를 작성했습니다, 읽어볼 만합니다.',
    '{title}이 어떻게 작동하는지 궁금했다면, 우리가 다루고 있습니다.',
    'SwapPulse가 처음이신가요? {title}의 작동 방식은 다음과 같습니다.',
    '{title}에 대해 질문을 많이 받아서, 완전한 가이드를 만들었습니다.',
    '{title} 가이드가 공개되었고 모든 것을 안내합니다.',
    '간단한 팁: {title}은 SwapPulse를 다르게 만드는 기능 중 하나입니다.',
    '방금 {title}에 대한 심층 분석을 공개했습니다.',
    'SwapPulse의 {title}에 대해 알아야 할 모든 것이 여기 있습니다.',
  ],
  helpValueProps: [
    'SwapPulse는 AT Protocol 위에 구축된 포켓몬 TCG 컬렉터를 위한 탈중앙화 소셜 네트워크입니다. 베타 단계이고 아직 구축 중입니다.',
    '광고 없음, 알고리즘 없음, 페이월 없음. 컬렉터들이 서로 돕는 것뿐. 무료이고 오픈소스.',
    'AT Protocol 위에 구축되어, 게시물이 Bluesky에도 표시될 수 있습니다. 같은 계정, 더 큰 도달.',
    '당신의 컬렉션, 게시물, 팔로우. 그것은 당신의 것. 휴대 가능하고 컬렉터 소유의 데이터.',
    '카드 스캔, 컬렉션 구축, 바인더 만들기, 트레이드 찾기, 모두 한 곳에서. 무료이고 오픈소스.',
  ],
  helpCtas: [
    '전체 가이드 읽기: {SITE_BASE}/help/{slug}',
    '한번 보세요: {SITE_BASE}/help/{slug}',
    '전체 가이드 여기: {SITE_BASE}/help/{slug}',
    '더 알아보기: {SITE_BASE}/help/{slug}',
  ],
};

export const PROMO_MESSAGES: Record<string, PromoMessagePools> = {
  'en-GB': en,
  'fr-FR': fr,
  'de-DE': de,
  'it-IT': it,
  'es-ES': es,
  'pt-BR': pt,
  'ja-JP': ja,
  'zh-CN': zh,
  'ko-KR': ko,
};

// "First to join" beta campaign hooks — urge collectors to be early members.
// Used by post-promo's first_join / first_join_all modes. One pool per locale.
export const FIRST_JOIN_HOOKS: Record<string, string[]> = {
  'en-GB': [
    "Be among the first to join SwapPulse. We're in beta, and early members shape what we build next.",
    "Founding members wanted. SwapPulse is in beta, and the first collectors in set the tone.",
    "Get in early. SwapPulse is in beta, and the first collectors help shape the platform.",
    "The first collectors on SwapPulse will always be the ones who believed early. Join in beta.",
  ],
  'fr-FR': [
    "Soyez parmi les premiers à rejoindre SwapPulse. Nous sommes en beta, et les premiers membres façonnent la suite.",
    "Membres fondateurs recherchés. SwapPulse est en beta, et les premiers collectionneurs donnent le ton.",
    "Entrez tôt. SwapPulse est en beta, et les premiers membres aident à façonner la plateforme.",
    "Les premiers collectionneurs sur SwapPulse seront toujours ceux qui ont cru en premier. Rejoignez en beta.",
  ],
  'de-DE': [
    "Sei einer der Ersten, die SwapPulse beitreten. Wir sind in der Beta, und frühe Mitglieder prägen, was entsteht.",
    "Gründungsmitglieder gesucht. SwapPulse ist in der Beta, und die ersten Sammler setzen den Ton.",
    "Früh dabei sein. SwapPulse ist in der Beta, und frühe Mitglieder helfen, die Plattform zu formen.",
    "Die ersten Sammler auf SwapPulse werden immer die sein, die früh geglaubt haben. Tritt der Beta bei.",
  ],
  'it-IT': [
    "Sii tra i primi a unirti a SwapPulse. Siamo in beta, e i primi membri modellano ciò che costruiremo.",
    "Cercasi membri fondatori. SwapPulse è in beta, e i primi collezionisti danno il tono.",
    "Entra presto. SwapPulse è in beta, e i primi membri aiutano a plasmare la piattaforma.",
    "I primi collezionisti su SwapPulse saranno sempre quelli che hanno creduto per primi. Unisciti in beta.",
  ],
  'es-ES': [
    "Sé de los primeros en unirte a SwapPulse. Estamos en beta, y los primeros miembros dan forma a lo que viene.",
    "Buscamos miembros fundadores. SwapPulse está en beta, y los primeros coleccionistas marcan el tono.",
    "Entra pronto. SwapPulse está en beta, y los primeros miembros ayudan a dar forma a la plataforma.",
    "Los primeros coleccionistas en SwapPulse siempre serán los que creyeron desde el principio. Únete en beta.",
  ],
  'pt-BR': [
    "Seja um dos primeiros a entrar no SwapPulse. Estamos em beta, e os primeiros membros moldam o que vem a seguir.",
    "Procuramos membros fundadores. SwapPulse está em beta, e os primeiros colecionadores dão o tom.",
    "Entre cedo. SwapPulse está em beta, e os primeiros membros ajudam a moldar a plataforma.",
    "Os primeiros colecionadores no SwapPulse serão sempre os que acreditaram primeiro. Entre em beta.",
  ],
  'ja-JP': [
    "SwapPulseの最初のメンバーになりましょう。ベータ版で、最初のメンバーが次に作るものを形作ります。",
    "創設メンバー募集中。SwapPulseはベータ版で、最初のコレクターが方向性を決めます。",
    "早く参加しよう。SwapPulseはベータ版で、最初のメンバーがプラットフォームを形作るのを助けます。",
    "SwapPulseの最初のコレクターは、常に早く信じた人たちです。ベータ版に参加しましょう。",
  ],
  'zh-CN': [
    "成为最早加入SwapPulse的人之一。我们在beta阶段，早期成员塑造我们接下来构建的内容。",
    "寻找创始成员。SwapPulse处于beta阶段，第一批收藏者定下基调。",
    "及早加入。SwapPulse处于beta阶段，早期成员帮助塑造平台。",
    "SwapPulse上最早的收藏者永远是那些早早相信的人。在beta阶段加入吧。",
  ],
  'ko-KR': [
    "SwapPulse의 첫 번째 멤버가 되세요. 베타 단계이고, 초기 멤버가 다음에 만들 것을 형성합니다.",
    "창립 멤버를 찾습니다. SwapPulse는 베타 단계이고, 첫 번째 컬렉터가 방향을 정합니다.",
    "일찍 참여하세요. SwapPulse는 베타 단계이고, 초기 멤버가 플랫폼을 형성하는 데 도움을 줍니다.",
    "SwapPulse의 첫 번째 컬렉터는 항상 일찍 믿은 사람들입니다. 베타에 참여하세요.",
  ],
};

/** Pick a random element from an array. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick a random promo locale. */
export function pickPromoLocale(): PromoLocale {
  return pick(PROMO_LOCALES);
}

/** Get the message pools for a given locale, falling back to English. */
export function getPoolsForLocale(locale: string): PromoMessagePools {
  return PROMO_MESSAGES[locale] || PROMO_MESSAGES['en-GB'];
}

/** Append a ?lang=LOCALE query param to a URL so the site loads in the
 * post's language when a user clicks through. Preserves any existing query. */
export function withLangParam(url: string, locale: string): string {
  if (!locale || locale === 'en-GB') return url;
  try {
    const u = new URL(url);
    u.searchParams.set('lang', locale);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}lang=${encodeURIComponent(locale)}`;
  }
}

/** Parse a hashtag-set string into canonical tag strings (strip #, trim,
 * lowercase, dedupe, cap at 8). */
export function parseTags(hashtagSet: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of hashtagSet.split(/\s+/)) {
    const tag = raw.replace(/^#/, '').trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

/** Count grapheme clusters (Bluesky's text limit is 300 graphemes). */
export function countGraphemes(str: string): number {
  try {
    const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return [...seg.segment(str)].length;
  } catch {
    return [...str].length;
  }
}