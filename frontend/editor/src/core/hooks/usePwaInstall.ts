import { useSyncExternalStore } from "react";
import { canInstall, isInstalled, subscribe } from "@app/utils/pwaInstall";

/**
 * Reactive view of the browser's PWA install state for the settings UI.
 * `installable` flips true once the browser offers a native install prompt;
 * `installed` is true when the app already runs standalone.
 */
export const usePwaInstall = (): {
  installable: boolean;
  installed: boolean;
} => {
  const installable = useSyncExternalStore(
    subscribe,
    canInstall,
    () => false,
  );
  const installed = useSyncExternalStore(subscribe, isInstalled, () => false);
  return { installable, installed };
};
