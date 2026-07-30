"use client";

import { useState, useEffect, useCallback } from "react";
import { isTokenExpired } from "@/lib/auth";

export interface User {
  username: string;
  avatar: string | null;
}

export interface UseAuthReturn {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  logout: () => void;
}

function initToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem("token");
  if (t && !isTokenExpired(t)) return t;
  return null;
}

function initUser(token: string | null): User | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user ?? null;
  } catch {
    return null;
  }
}

export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState<string | null>(initToken);
  const [user, setUser] = useState<User | null>(() => initUser(initToken()));

  useEffect(() => {
    const sessionCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("__session="));
    if (sessionCookie) {
      const t = sessionCookie.split("=")[1];
      if (t) {
        localStorage.setItem("token", t);
        document.cookie = "__session=; path=/; max-age=0";
      }
    }

    const stored = localStorage.getItem("token");
    if (stored) {
      if (isTokenExpired(stored)) {
        localStorage.removeItem("token");
      } else {
        setToken(stored);
        try {
          const payload = JSON.parse(atob(stored.split(".")[1]));
          if (payload.user) {
            setUser(payload.user);
          }
        } catch {
          localStorage.removeItem("token");
        }
      }
    }

    const handler = (e: StorageEvent) => {
      if (e.key === "token") {
        if (e.newValue) {
          setToken(e.newValue);
          try {
            const payload = JSON.parse(atob(e.newValue.split(".")[1]));
            setUser(payload.user ?? null);
          } catch {
            setUser(null);
          }
        } else {
          setToken(null);
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  return { token, user, isLoggedIn: !!token, logout };
}
