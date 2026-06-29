import { useEffect, useState } from "react";
import { useAuthStore } from "./client";

export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    // Safety net: if storage stalls/errors, don't trap the user on a blank screen.
    const timeout = setTimeout(() => setHydrated(true), 3000);
    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, [hydrated]);
  return hydrated;
}
