"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  BAR_STYLE_EVENT,
  DEFAULT_BAR_STYLE,
  readBarStyle,
  writeBarStyle,
} from "./barStyles";

/**
 * Reads the stored bar-style preference and keeps it in sync.
 *
 * useSyncExternalStore rather than useState + useEffect. The effect version
 * has to write state immediately on mount to get localStorage in, which is a
 * synchronous setState in an effect body: the component renders once with the
 * default and again with the stored value, and the tree is committed twice on
 * every mount of every table. Worse, `readBarStyle` is not idempotent under
 * React's snapshot rules in spirit — the "current" value and the value React
 * rendered with are different moments.
 *
 * As a subscription with an explicit server snapshot there is one render on
 * the server (the default), one on hydration, and the stored value arrives in
 * the same pass the browser takes over.
 *
 * The preference follows the device rather than the account — a deliberate
 * trade-off documented in barStyles.ts.
 */
export function useBarStyle(): [string, (id: string) => void] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    // Another tab changed it.
    window.addEventListener("storage", onStoreChange);
    // This tab changed it.
    window.addEventListener(BAR_STYLE_EVENT, onStoreChange);

    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(BAR_STYLE_EVENT, onStoreChange);
    };
  }, []);

  const barStyle = useSyncExternalStore(
    subscribe,
    readBarStyle,
    () => DEFAULT_BAR_STYLE
  );

  const choose = useCallback((id: string) => {
    writeBarStyle(id);
    // Notify this tab's own subscribers. writeBarStyle has already made the
    // new value readable, so the re-read returns it.
    window.dispatchEvent(new Event(BAR_STYLE_EVENT));
  }, []);

  return [barStyle, choose];
}

/** Subscribes to nothing; just reports whether the browser has taken over. */
const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards.
 *
 * The canonical `useSyncExternalStore` idiom for "am I in the browser yet",
 * and the reason no component here needs a `useEffect` that sets a flag on
 * mount. The server snapshot and the client snapshot differ, so React knows
 * exactly when the handover happened and re-renders once.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
