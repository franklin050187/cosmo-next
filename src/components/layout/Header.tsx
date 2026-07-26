"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface User {
  username: string;
  avatar: string | null;
}

const NAV_LINKS = [
  { href: "/", label: "Ships" },
  { href: "/upload", label: "Upload" },
  { href: "/my-ships", label: "My Ships" },
  { href: "/favorites", label: "My Favorites" },
  { href: "/my-collections", label: "My Collections" },
  { href: "/about", label: "About" },
];

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Login was cancelled.",
  no_code: "Login failed — no authorization code received.",
  token_exchange_failed: "Login failed — could not verify with Discord.",
  user_fetch_failed: "Login failed — could not fetch Discord profile.",
  csrf_failed: "Login failed — session expired. Please try again.",
  auth_failed: "Login failed. Please try again.",
};

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = pathname + (searchParams.toString() ? `?${searchParams}` : "");
  const menuRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Read browser-only state (localStorage, URL params, session cookie) once on mount.
  // Must be in effect to avoid hydration mismatch: server always renders null/default.
  useEffect(() => {
    // Token from __session cookie (set by OAuth callback, never in URL)
    const sessionCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("__session="));
    if (sessionCookie) {
      const token = sessionCookie.split("=")[1];
      if (token) {
        localStorage.setItem("token", token);
        // Clear the session cookie immediately
        document.cookie = "__session=; path=/; max-age=0";
      }
    }

    const stored = localStorage.getItem("token");
    if (stored) {
      try {
        const payload = JSON.parse(atob(stored.split(".")[1]));
        if (payload.user) setUser(payload.user); // eslint-disable-line react-hooks/set-state-in-effect
      } catch {
        localStorage.removeItem("token");
      }
    }

    const error = new URLSearchParams(window.location.search).get("auth_error");
    if (error) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      setAuthErrorCode(error);
    }
  }, []);

  const authError = authErrorCode && !dismissed ? (AUTH_ERROR_MESSAGES[authErrorCode] || "Login failed. Please try again.") : null;

  useEffect(() => {
    if (!authError) return;
    const timer = setTimeout(() => setDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, [authError]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setMenuOpen(false);
    window.location.href = "/";
  };

  return (
    <>
    <header className="fixed top-0 inset-x-0 z-20 bg-[#021526]/80 backdrop-blur-md border-b border-[#1C598C]/50">
      <div className="max-w-[1360px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <img alt="CosmoShip" src="/logo-v2.svg" width={120} height={32} className="h-8 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-blue-200/80 hover:text-white rounded-md hover:bg-white/5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* User — desktop */}
          {user && (
            <div className="hidden md:flex items-center gap-2">
              {user.avatar && (
                <img src={user.avatar} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-sm text-blue-200">{user.username}</span>
            </div>
          )}

          {/* Desktop auth */}
          <div className="hidden md:block">
            {user ? (
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link
                href={`/auth/discord?returnTo=${encodeURIComponent(returnTo)}`}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Login with Discord
              </Link>
            )}
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden relative w-8 h-8 flex items-center justify-center"
            aria-label="Menu"
          >
            <span
              className={`absolute w-5 h-0.5 bg-cyan-400 rounded transition-all duration-200 ${
                menuOpen ? "rotate-45" : "-translate-y-1.5"
              }`}
            />
            <span
              className={`absolute w-5 h-0.5 bg-cyan-400 rounded transition-all duration-200 ${
                menuOpen ? "opacity-0 scale-0" : ""
              }`}
            />
            <span
              className={`absolute w-5 h-0.5 bg-cyan-400 rounded transition-all duration-200 ${
                menuOpen ? "-rotate-45" : "translate-y-1.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div
        ref={menuRef}
        className={`md:hidden overflow-hidden transition-all duration-200 ${
          menuOpen ? "max-h-80" : "max-h-0"
        }`}
      >
        <nav className="bg-[#021526] border-t border-[#1C598C]/30 px-4 py-3 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 text-sm text-blue-200/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-[#1C598C]/20 mt-2 pt-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2">
                  {user.avatar && (
                    <img src={user.avatar} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-sm text-blue-200">{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href={`/auth/discord?returnTo=${encodeURIComponent(returnTo)}`}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                Login with Discord
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
    {authError && (
      <div className="fixed top-14 inset-x-0 z-20 flex justify-center px-4">
        <div className="flex items-center gap-3 bg-red-900/80 border border-red-500/40 backdrop-blur-md text-red-200 text-sm px-4 py-2.5 rounded-lg shadow-lg animate-fade-in">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {authError}
          <button onClick={() => setDismissed(true)} className="ml-2 text-red-400 hover:text-white" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )}
    </>
  );
}
