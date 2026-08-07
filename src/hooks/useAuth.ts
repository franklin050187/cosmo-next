"use client";

import { useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  username: string;
  avatar: string | null;
  guild?: string;
}

export interface UseAuthReturn {
  user: User | null;
  isLoggedIn: boolean;
  hydrated: boolean;
  logout: () => void;
}

let sessionPromise: Promise<User | null> | null = null;

function fetchSession(): Promise<User | null> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((d: { data: { user: User } | null }) => d.data?.user ?? null)
      .catch(() => null)
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    function refetch() {
      sessionPromise = null;
      fetchSession().then((u) => {
        if (active) {
          setUser(u);
          setHydrated(true);
        }
      });
    }

    refetch();

    // Signal a fresh login to other tabs; this tab already fetched above.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("just_logged_in") === "1") {
      try {
        localStorage.setItem("cosmoshipro:auth:login", Date.now().toString());
      } catch { /* storage disabled */ }
      const url = new URL(window.location.href);
      url.searchParams.delete("just_logged_in");
      window.history.replaceState({}, "", url.toString());
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "cosmoshipro:auth:login" && e.key !== "cosmoshipro:auth:logout") return;
      refetch();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    sessionPromise = null;
    try {
      localStorage.setItem("cosmoshipro:auth:logout", Date.now().toString());
    } catch { /* storage disabled */ }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // cookie already cleared client-side state; navigation will follow
    }
  }, []);

  return { user, isLoggedIn: !!user, hydrated, logout };
}
