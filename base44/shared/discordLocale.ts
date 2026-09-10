export type DiscordLocale = 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' | 'it-IT' | 'pt-BR' | 'ja-JP' | 'zh-CN' | 'ko-KR';

type DiscordCopy = {
  unsupported: string;
  wrongServer: string;
  accountUnknown: string;
  verifyTitle: string;
  verifyBody: string;
  accountButton: string;
  captchaButton: string;
  notVerified: string;
  rolesCurrent: (roles: string) => string;
  rolesPending: string;
  support: string;
  developers: string;
  features: string;
  announcements: string;
  supportPending: string;
  unknownCommand: string;
  temporaryError: string;
};

const COPY: Record<DiscordLocale, DiscordCopy> = {
  'en-GB': {
    unsupported: 'That interaction is not supported.',
    wrongServer: 'SwapPulse Bot is not configured for this server.',
    accountUnknown: 'Discord could not confirm your account.',
    verifyTitle: '**Verify with SwapPulse**',
    verifyBody: 'Choose one method. Linking your SwapPulse account can add trust and staff roles. The CAPTCHA-only route grants Collector access.',
    accountButton: 'Link SwapPulse account',
    captchaButton: 'CAPTCHA only',
    notVerified: 'You are not verified yet. Use /verify to begin.',
    rolesCurrent: (roles) => `Your current SwapPulse-managed roles: ${roles}.`,
    rolesPending: 'Your verification is recorded. Automatic role reconciliation runs every 30 minutes.',
    support: 'Support',
    developers: 'Developer forum',
    features: 'Feature requests',
    announcements: 'Announcements',
    supportPending: 'Support channels are still being configured.',
    unknownCommand: 'Unknown command. Try /verify, /roles, or /support.',
    temporaryError: 'SwapPulse Bot could not complete that request. Please try again shortly.',
  },
  'es-ES': {
    unsupported: 'Esta interacción no es compatible.',
    wrongServer: 'SwapPulse Bot no está configurado para este servidor.',
    accountUnknown: 'Discord no pudo confirmar tu cuenta.',
    verifyTitle: '**Verificación con SwapPulse**',
    verifyBody: 'Elige un método. Vincular tu cuenta de SwapPulse puede añadir roles de confianza y equipo. La opción solo CAPTCHA concede acceso de Coleccionista.',
    accountButton: 'Vincular cuenta SwapPulse',
    captchaButton: 'Solo CAPTCHA',
    notVerified: 'Aún no estás verificado. Usa /verify para empezar.',
    rolesCurrent: (roles) => `Tus roles actuales gestionados por SwapPulse: ${roles}.`,
    rolesPending: 'Tu verificación está registrada. La sincronización automática de roles se ejecuta cada 30 minutos.',
    support: 'Soporte',
    developers: 'Foro de desarrollo',
    features: 'Solicitudes de funciones',
    announcements: 'Anuncios',
    supportPending: 'Los canales de soporte aún se están configurando.',
    unknownCommand: 'Comando desconocido. Prueba /verify, /roles o /support.',
    temporaryError: 'SwapPulse Bot no pudo completar la solicitud. Inténtalo de nuevo en breve.',
  },
  'fr-FR': {
    unsupported: 'Cette interaction n’est pas prise en charge.',
    wrongServer: 'SwapPulse Bot n’est pas configuré pour ce serveur.',
    accountUnknown: 'Discord n’a pas pu confirmer votre compte.',
    verifyTitle: '**Vérification avec SwapPulse**',
    verifyBody: 'Choisissez une méthode. Associer votre compte SwapPulse peut ajouter des rôles de confiance et d’équipe. Le CAPTCHA seul accorde l’accès Collectionneur.',
    accountButton: 'Associer le compte SwapPulse',
    captchaButton: 'CAPTCHA uniquement',
    notVerified: 'Vous n’êtes pas encore vérifié. Utilisez /verify pour commencer.',
    rolesCurrent: (roles) => `Vos rôles actuels gérés par SwapPulse : ${roles}.`,
    rolesPending: 'Votre vérification est enregistrée. La synchronisation automatique des rôles s’exécute toutes les 30 minutes.',
    support: 'Assistance',
    developers: 'Forum développeurs',
    features: 'Demandes de fonctionnalités',
    announcements: 'Annonces',
    supportPending: 'Les canaux d’assistance sont encore en cours de configuration.',
    unknownCommand: 'Commande inconnue. Essayez /verify, /roles ou /support.',
    temporaryError: 'SwapPulse Bot n’a pas pu traiter cette demande. Réessayez bientôt.',
  },
  'de-DE': {
    unsupported: 'Diese Interaktion wird nicht unterstützt.',
    wrongServer: 'SwapPulse Bot ist für diesen Server nicht konfiguriert.',
    accountUnknown: 'Discord konnte dein Konto nicht bestätigen.',
    verifyTitle: '**Mit SwapPulse verifizieren**',
    verifyBody: 'Wähle eine Methode. Durch das Verknüpfen deines SwapPulse-Kontos können Vertrauens- und Teamrollen vergeben werden. Nur CAPTCHA gewährt Sammlerzugang.',
    accountButton: 'SwapPulse-Konto verknüpfen',
    captchaButton: 'Nur CAPTCHA',
    notVerified: 'Du bist noch nicht verifiziert. Nutze /verify, um zu beginnen.',
    rolesCurrent: (roles) => `Deine aktuellen von SwapPulse verwalteten Rollen: ${roles}.`,
    rolesPending: 'Deine Verifizierung ist gespeichert. Der automatische Rollenabgleich läuft alle 30 Minuten.',
    support: 'Support',
    developers: 'Entwicklerforum',
    features: 'Funktionswünsche',
    announcements: 'Ankündigungen',
    supportPending: 'Die Supportkanäle werden noch eingerichtet.',
    unknownCommand: 'Unbekannter Befehl. Versuche /verify, /roles oder /support.',
    temporaryError: 'SwapPulse Bot konnte die Anfrage nicht abschließen. Bitte versuche es gleich noch einmal.',
  },
  'it-IT': {
    unsupported: 'Questa interazione non è supportata.',
    wrongServer: 'SwapPulse Bot non è configurato per questo server.',
    accountUnknown: 'Discord non ha potuto confermare il tuo account.',
    verifyTitle: '**Verifica con SwapPulse**',
    verifyBody: 'Scegli un metodo. Collegando il tuo account SwapPulse puoi ottenere ruoli di fiducia e dello staff. Il solo CAPTCHA concede l’accesso Collezionista.',
    accountButton: 'Collega account SwapPulse',
    captchaButton: 'Solo CAPTCHA',
    notVerified: 'Non sei ancora verificato. Usa /verify per iniziare.',
    rolesCurrent: (roles) => `I tuoi ruoli attuali gestiti da SwapPulse: ${roles}.`,
    rolesPending: 'La verifica è stata registrata. La sincronizzazione automatica dei ruoli viene eseguita ogni 30 minuti.',
    support: 'Assistenza',
    developers: 'Forum sviluppatori',
    features: 'Richieste di funzionalità',
    announcements: 'Annunci',
    supportPending: 'I canali di assistenza sono ancora in configurazione.',
    unknownCommand: 'Comando sconosciuto. Prova /verify, /roles o /support.',
    temporaryError: 'SwapPulse Bot non ha potuto completare la richiesta. Riprova tra poco.',
  },
  'pt-BR': {
    unsupported: 'Esta interação não é compatível.',
    wrongServer: 'O SwapPulse Bot não está configurado para este servidor.',
    accountUnknown: 'O Discord não conseguiu confirmar sua conta.',
    verifyTitle: '**Verificar com o SwapPulse**',
    verifyBody: 'Escolha um método. Vincular sua conta do SwapPulse pode adicionar cargos de confiança e equipe. A opção somente CAPTCHA concede acesso de Colecionador.',
    accountButton: 'Vincular conta SwapPulse',
    captchaButton: 'Somente CAPTCHA',
    notVerified: 'Você ainda não foi verificado. Use /verify para começar.',
    rolesCurrent: (roles) => `Seus cargos atuais gerenciados pelo SwapPulse: ${roles}.`,
    rolesPending: 'Sua verificação foi registrada. A sincronização automática de cargos ocorre a cada 30 minutos.',
    support: 'Suporte',
    developers: 'Fórum de desenvolvedores',
    features: 'Solicitações de recursos',
    announcements: 'Anúncios',
    supportPending: 'Os canais de suporte ainda estão sendo configurados.',
    unknownCommand: 'Comando desconhecido. Tente /verify, /roles ou /support.',
    temporaryError: 'O SwapPulse Bot não conseguiu concluir a solicitação. Tente novamente em breve.',
  },
  'ja-JP': {
    unsupported: 'この操作には対応していません。',
    wrongServer: 'このサーバーには SwapPulse Bot が設定されていません。',
    accountUnknown: 'Discord アカウントを確認できませんでした。',
    verifyTitle: '**SwapPulse で認証**',
    verifyBody: '認証方法を選んでください。SwapPulse アカウントを連携すると、信頼度やスタッフのロールが追加される場合があります。CAPTCHA のみでは Collector ロールが付与されます。',
    accountButton: 'SwapPulse アカウントを連携',
    captchaButton: 'CAPTCHA のみ',
    notVerified: 'まだ認証されていません。/verify から始めてください。',
    rolesCurrent: (roles) => `現在の SwapPulse 管理ロール: ${roles}。`,
    rolesPending: '認証は記録されています。ロールは30分ごとに自動同期されます。',
    support: 'サポート',
    developers: '開発者フォーラム',
    features: '機能リクエスト',
    announcements: 'お知らせ',
    supportPending: 'サポートチャンネルは現在設定中です。',
    unknownCommand: '不明なコマンドです。/verify、/roles、/support をお試しください。',
    temporaryError: 'SwapPulse Bot はリクエストを完了できませんでした。しばらくしてから再度お試しください。',
  },
  'zh-CN': {
    unsupported: '不支持此交互操作。',
    wrongServer: '此服务器尚未配置 SwapPulse Bot。',
    accountUnknown: 'Discord 无法确认你的账户。',
    verifyTitle: '**使用 SwapPulse 验证**',
    verifyBody: '请选择一种方式。关联 SwapPulse 账户后可获得信誉和团队角色；仅使用 CAPTCHA 将获得收藏者访问权限。',
    accountButton: '关联 SwapPulse 账户',
    captchaButton: '仅 CAPTCHA',
    notVerified: '你尚未验证。请使用 /verify 开始。',
    rolesCurrent: (roles) => `你当前由 SwapPulse 管理的角色：${roles}。`,
    rolesPending: '你的验证已记录。角色每30分钟自动同步一次。',
    support: '支持',
    developers: '开发者论坛',
    features: '功能建议',
    announcements: '公告',
    supportPending: '支持频道仍在配置中。',
    unknownCommand: '未知命令。请尝试 /verify、/roles 或 /support。',
    temporaryError: 'SwapPulse Bot 暂时无法完成该请求。请稍后重试。',
  },
  'ko-KR': {
    unsupported: '지원하지 않는 상호작용입니다.',
    wrongServer: '이 서버에는 SwapPulse Bot이 설정되어 있지 않습니다.',
    accountUnknown: 'Discord 계정을 확인할 수 없습니다.',
    verifyTitle: '**SwapPulse로 인증**',
    verifyBody: '인증 방법을 선택하세요. SwapPulse 계정을 연결하면 신뢰 및 운영진 역할을 받을 수 있습니다. CAPTCHA만 사용하면 Collector 접근 권한이 부여됩니다.',
    accountButton: 'SwapPulse 계정 연결',
    captchaButton: 'CAPTCHA만 사용',
    notVerified: '아직 인증되지 않았습니다. /verify로 시작하세요.',
    rolesCurrent: (roles) => `현재 SwapPulse가 관리하는 역할: ${roles}.`,
    rolesPending: '인증이 기록되었습니다. 역할은 30분마다 자동으로 동기화됩니다.',
    support: '지원',
    developers: '개발자 포럼',
    features: '기능 요청',
    announcements: '공지',
    supportPending: '지원 채널을 아직 설정하고 있습니다.',
    unknownCommand: '알 수 없는 명령입니다. /verify, /roles 또는 /support를 사용하세요.',
    temporaryError: 'SwapPulse Bot이 요청을 완료하지 못했습니다. 잠시 후 다시 시도하세요.',
  },
};

export function normaliseDiscordLocale(value: unknown): DiscordLocale {
  const locale = String(value || '').toLowerCase();
  if (locale.startsWith('es')) return 'es-ES';
  if (locale.startsWith('fr')) return 'fr-FR';
  if (locale.startsWith('de')) return 'de-DE';
  if (locale.startsWith('it')) return 'it-IT';
  if (locale.startsWith('pt')) return 'pt-BR';
  if (locale.startsWith('ja')) return 'ja-JP';
  if (locale.startsWith('zh')) return 'zh-CN';
  if (locale.startsWith('ko')) return 'ko-KR';
  return 'en-GB';
}

export function discordCopy(value: unknown): DiscordCopy {
  return COPY[normaliseDiscordLocale(value)];
}
