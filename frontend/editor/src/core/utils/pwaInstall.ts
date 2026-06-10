// Tiny subscribable store around the browser's PWA install flow.
//
// The `beforeinstallprompt` event can fire before React mounts, so we start
// listening at module import time and stash the deferred event. The settings
// UI reads installability/installed state via the `usePwaInstall` hook.

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

/** Running inside the Tauri desktop shell — install UI makes no sense there. */
export const isDesktopShell = (): boolean =>
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

/** Already launched as an installed app (standalone window). */
export const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  const displayStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari exposes a non-standard navigator.standalone flag.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  return displayStandalone || iosStandalone;
};

if (typeof window !== "undefined" && !isDesktopShell()) {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Stop Chrome's mini-infobar so we can trigger the prompt from Settings.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}

/** The browser is ready to show a native install prompt right now. */
export const canInstall = (): boolean => deferredPrompt !== null;

/** The app is already installed (event seen, or running standalone). */
export const isInstalled = (): boolean => installed || isStandalone();

/** Trigger the native install dialog. Resolves with the user's choice. */
export const promptInstall = async (): Promise<InstallOutcome> => {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === "accepted") {
    installed = true;
  }
  deferredPrompt = null;
  emit();
  return choice.outcome;
};

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
