/**
 * PWA install affordance (R10.2). Chrome/Android fire `beforeinstallprompt` once, often before any
 * screen mounts, so we capture it at app startup (`initInstallCapture` from main.tsx) into a module
 * singleton and replay the state to React via `useInstallPrompt`. iOS/Safari has no prompt API — there
 * we surface manual "Share → Add to Home Screen" instructions instead. Already-installed sessions are
 * detected via the standalone display mode.
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches === true;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

/** iOS Safari (incl. iPadOS reporting as Mac) where install is manual, and not already installed. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice =
    /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOSDevice && !detectInstalled();
}

/** Wire the global capture once, at startup. Idempotent enough for a single call from main.tsx. */
export function initInstallCapture(): void {
  if (typeof window === "undefined") return;
  installed = detectInstalled();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export type InstallState = "installed" | "installable" | "ios" | "unavailable";
export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export function useInstallPrompt(): { state: InstallState; promptInstall: () => Promise<InstallOutcome> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = (): void => force((n) => n + 1);
    listeners.add(l);
    // Re-check the standalone flag on mount (e.g. user installed then reopened in the browser tab).
    installed = detectInstalled();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const state: InstallState = installed
    ? "installed"
    : deferred
      ? "installable"
      : isIOS()
        ? "ios"
        : "unavailable";

  const promptInstall = async (): Promise<InstallOutcome> => {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null; // the event is single-use
    emit();
    return choice.outcome;
  };

  return { state, promptInstall };
}
