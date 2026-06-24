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
