/**
 * Tiny, dependency-free i18n layer (DEC-039 Q-K: English default, switchable in Settings, per-user).
 *
 * English is the single source of truth — every key has an EN string; Portuguese is an overlay that
 * falls back to EN for any key it doesn't translate. `useT()` is bound to the persisted language
 * (`app/settings.useLanguage`), so flipping the switch re-renders every consumer immediately.
 *
 * Scope is intentional, not total: the global navigation and the whole Settings area are translated
 * (the surfaces this gate owns); other screens fall back to English until they're wired. Adding a
 * screen later is just adding its keys here and swapping its literals for `t("…")`.
 */
import { useCallback } from "react";
import { useLanguage, type Language } from "../app/settings";

type Vars = Record<string, string | number>;

const EN = {
  // Global navigation (BottomNav)
  "nav.now": "Now",
  "nav.timetable": "Timetable",
  "nav.myPlan": "My Plan",
  "nav.map": "Map",
  "nav.squad": "Squad",

  // Settings
  "settings.title": "Settings",
  "settings.appearanceLang": "Appearance & language",
  "settings.appearanceLangSub": "{appearance} · {language}",
  "settings.offline": "Offline & data",
  "settings.offlineSub": "Cached for offline use on site",
  "settings.notifications": "Notifications",
  "settings.notificationsSub": "Set alerts coming in a later phase",
  "settings.soon": "Soon",
  "settings.privacy": "Location & privacy",
  "settings.privacySub": "Master switch · default mode · pause all",
  "settings.autoShare": "Auto-share plan when I join a squad",
  "settings.autoShareSub": "Offer to share your plan + favorites when you join",
  "settings.about": "About & what's new",
  "settings.aboutSub": "Version, the story, and the update history",

  // Appearance & language screen
  "appearance.appearance": "Appearance",
  "appearance.auto": "Auto",
  "appearance.autoHint": "Follows the festival clock",
  "appearance.day": "Day",
  "appearance.dayHint": "Light map art",
  "appearance.night": "Night",
  "appearance.nightHint": "Dark map art",
  "appearance.hintLine": "{hint} · currently showing the {palette} map.",
  "appearance.language": "Language",
  "appearance.languageNote": "English is the default. Português switches the app's navigation and settings.",

  // Offline & data screen
  "offline.connection": "Connection",
  "offline.online": "Online",
  "offline.offline": "Offline — showing cached data",
  "offline.live": "Live",
  "offline.cached": "Cached",
  "offline.lineup": "Lineup",
  "offline.venueMap": "Venue map",
  "offline.mapArt": "Map artwork",
  "offline.availableOffline": "Available offline",
  "offline.willCache": "Will cache when you save",
  "offline.ready": "Ready",
  "offline.notSaved": "Not saved",
  "offline.unsupported": "Offline storage isn't available in this browser. Install the app to cache for no-signal use.",
  "offline.saving": "Saving…",
  "offline.saved": "Saved for offline",
  "offline.refresh": "Refresh offline data",
  "offline.makeAvailable": "Make available offline",
  "offline.blurb": "FestPilot caches the app, the venue map and the lineup so the essentials work on a packed field with no signal.",

  // PWA install
  "install.title": "Installed app",
  "install.running": "Running as an installed app",
  "install.add": "Add to Home Screen",
  "install.addSub": "Install for full-screen, offline-ready use",
  "install.installed": "Installed",
  "install.iosSub": "In Safari: tap Share, then \u201cAdd to Home Screen\u201d.",
  "install.unavailableSub": "Open in Chrome or Safari on your phone to install",

  // Update check
  "update.check": "Check for updates",
  "update.checking": "Checking\u2026",
  "update.current": "You're on the latest version (v{version}).",
  "update.ready": "A new version is ready.",
  "update.reload": "Reload to update",
  "update.unsupported": "Update checks aren't available in this browser.",

  // Shared palette words (used inside templated copy)
  "palette.day": "day",
  "palette.night": "night",
} as const;

export type MessageKey = keyof typeof EN;

const PT: Partial<Record<MessageKey, string>> = {
  "nav.now": "Agora",
  "nav.timetable": "Horários",
  "nav.myPlan": "Meu Plano",
  "nav.map": "Mapa",
  "nav.squad": "Grupo",

  "settings.title": "Ajustes",
  "settings.appearanceLang": "Aparência e idioma",
  "settings.appearanceLangSub": "{appearance} · {language}",
  "settings.offline": "Offline e dados",
  "settings.offlineSub": "Salvo para uso offline no local",
  "settings.notifications": "Notificações",
  "settings.notificationsSub": "Alertas de set chegam numa fase futura",
  "settings.soon": "Em breve",
  "settings.privacy": "Localização e privacidade",
  "settings.privacySub": "Chave geral · modo padrão · pausar tudo",
  "settings.autoShare": "Compartilhar plano ao entrar num grupo",
  "settings.autoShareSub": "Oferece compartilhar seu plano + favoritos ao entrar",
  "settings.about": "Sobre e novidades",
  "settings.aboutSub": "Versão, a história e o histórico de novidades",

  "appearance.appearance": "Aparência",
  "appearance.auto": "Auto",
  "appearance.autoHint": "Segue o relógio do festival",
  "appearance.day": "Dia",
  "appearance.dayHint": "Mapa em arte clara",
  "appearance.night": "Noite",
  "appearance.nightHint": "Mapa em arte escura",
  "appearance.hintLine": "{hint} · mostrando o mapa de {palette} agora.",
  "appearance.language": "Idioma",
  "appearance.languageNote": "O inglês é o padrão. Português muda a navegação e os ajustes do app.",

  "offline.connection": "Conexão",
  "offline.online": "Online",
  "offline.offline": "Offline — mostrando dados salvos",
  "offline.live": "Ao vivo",
  "offline.cached": "Salvo",
  "offline.lineup": "Line-up",
  "offline.venueMap": "Mapa do local",
  "offline.mapArt": "Arte do mapa",
  "offline.availableOffline": "Disponível offline",
  "offline.willCache": "Será salvo quando você guardar",
  "offline.ready": "Pronto",
  "offline.notSaved": "Não salvo",
  "offline.unsupported": "Armazenamento offline indisponível neste navegador. Instale o app para usar sem sinal.",
  "offline.saving": "Salvando\u2026",
  "offline.saved": "Salvo para offline",
  "offline.refresh": "Atualizar dados offline",
  "offline.makeAvailable": "Salvar para uso offline",
  "offline.blurb": "O FestPilot salva o app, o mapa do local e o line-up para o essencial funcionar num campo lotado e sem sinal.",

  "install.title": "App instalado",
  "install.running": "Rodando como app instalado",
  "install.add": "Adicionar à tela inicial",
  "install.addSub": "Instale para uso em tela cheia e offline",
  "install.installed": "Instalado",
  "install.iosSub": "No Safari: toque em Compartilhar e em \u201cAdicionar à Tela de Início\u201d.",
  "install.unavailableSub": "Abra no Chrome ou Safari do celular para instalar",

  "update.check": "Procurar atualizações",
  "update.checking": "Procurando\u2026",
  "update.current": "Você está na versão mais recente (v{version}).",
  "update.ready": "Uma nova versão está pronta.",
  "update.reload": "Recarregar para atualizar",
  "update.unsupported": "Verificação de atualização indisponível neste navegador.",

  "palette.day": "dia",
  "palette.night": "noite",
};

const DICT: Record<Language, Partial<Record<MessageKey, string>>> = { en: EN, pt: PT };

function interpolate(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Pure translation: language overlay → English source-of-truth → the key itself (never throws). */
export function translate(language: Language, key: MessageKey, vars?: Vars): string {
  const raw = DICT[language]?.[key] ?? EN[key] ?? key;
  return vars ? interpolate(raw, vars) : raw;
}

export type TranslateFn = (key: MessageKey, vars?: Vars) => string;

/** Reactive translator bound to the user's persisted language. */
export function useT(): TranslateFn {
  const { language } = useLanguage();
  return useCallback<TranslateFn>((key, vars) => translate(language, key, vars), [language]);
}
