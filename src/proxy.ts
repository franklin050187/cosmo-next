import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

const loginLimiter = createRateLimiter({ tokens: 5, windowMs: 60_000, keyPrefix: "login" });
const uploadLimiter = createRateLimiter({ tokens: 10, windowMs: 60_000, keyPrefix: "upload" });
const apiLimiter = createRateLimiter({ tokens: 60, windowMs: 60_000, keyPrefix: "api" });
const checkDuplicateLimiter = createRateLimiter({ tokens: 20, windowMs: 60_000, keyPrefix: "check-dup" });

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getLimiterForPath(pathname: string) {
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/")) return loginLimiter;
  if (pathname.startsWith("/api/uploadthing")) return uploadLimiter;
  if (pathname === "/api/ship/check-duplicate") return checkDuplicateLimiter;
  if (pathname.startsWith("/api/")) return apiLimiter;
  return null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-Turnstile-Token",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    };
  }
  return {};
}

function applyHeaders(res: NextResponse, headers: Record<string, string>) {
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/\-/g, "");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data:;
    font-src 'self';
    connect-src 'self' https://discord.com https://challenges.cloudflare.com https://i.ibb.co https://*.ufs.sh https://res.cloudinary.com https://*.uploadthing.com;
    frame-src https://challenges.cloudflare.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export async function middleware(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  // check-duplicate has its own limiter but also needs CORS
  if (req.nextUrl.pathname === "/api/ship/check-duplicate") {
    const ip = getClientIp(req);
    const result = await checkDuplicateLimiter.limit(ip);
    const headers = { ...rateLimitHeaders(result), ...cors };
    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const proxyResponse = await proxy(req);
    applyHeaders(proxyResponse, headers);
    return proxyResponse;
  }

  const limiter = getLimiterForPath(req.nextUrl.pathname);
  if (limiter) {
    const ip = getClientIp(req);
    const result = await limiter.limit(ip);
    const headers = { ...rateLimitHeaders(result), ...cors };

    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const proxyResponse = await proxy(req);
    applyHeaders(proxyResponse, headers);
    return proxyResponse;
  }

  const proxyResponse = await proxy(req);
  applyHeaders(proxyResponse, cors);
  return proxyResponse;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
