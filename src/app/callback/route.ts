import { NextRequest, NextResponse } from "next/server";
import { generateUserToken, type UserPayload } from "@/lib/auth";

const DISCORD_API = "https://discord.com/api/v10";

function getClientUrl(): string {
  const url = process.env.CLIENT_URL;
  if (!url) throw new Error("CLIENT_URL env var is required");
  return url;
}

export async function GET(req: NextRequest) {
  const clientUrl = getClientUrl();

  // CSRF validation
  const state = req.nextUrl.searchParams.get("state");
  const csrfCookie = req.cookies.get("oauth_csrf")?.value;
  const returnTo = decodeURIComponent(req.cookies.get("oauth_return")?.value || "/");

  if (!state || !csrfCookie || state !== csrfCookie) {
    return NextResponse.redirect(`${clientUrl}/${returnTo.startsWith("/") ? "" : "/"}${returnTo.replace(/^\//, "")}?auth_error=csrf_failed`);
  }

  // Discord returned an error (e.g. user cancelled)
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(`${clientUrl}${returnTo}?auth_error=${encodeURIComponent(error)}`);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${clientUrl}${returnTo}?auth_error=no_code`);
  }

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${clientUrl}${returnTo}?auth_error=token_exchange_failed`);
    }

    const { access_token } = await tokenRes.json();

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${clientUrl}${returnTo}?auth_error=user_fetch_failed`);
    }

    const discordUser = await userRes.json();

    // Check guilds for branding
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    let guild = "gen";
    if (guildsRes.ok) {
      const guilds = await guildsRes.json();
      const guildExcelsior = process.env.DISCORD_GUILD_EXCELSIOR_ID;
      const guildCosmoteer = process.env.DISCORD_GUILD_COSMOTEER_ID;
      for (const g of guilds) {
        if (guildExcelsior && g.id === guildExcelsior) {
          guild = "exl";
          break;
        }
        if (guildCosmoteer && g.id === guildCosmoteer) {
          guild = "gen";
        }
      }
    }

    const user: UserPayload = {
      id: discordUser.id,
      username: `${discordUser.username}#${discordUser.discriminator}`,
      avatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null,
      guild,
    };

    const token = generateUserToken(user);

    // Clear OAuth cookies and set session cookie (never in URL — prevents token leakage)
    const res = NextResponse.redirect(`${clientUrl}${returnTo}`);
    res.cookies.set("__session", token, {
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      maxAge: 60,
    });
    res.cookies.set("oauth_csrf", "", { path: "/", maxAge: 0 });
    res.cookies.set("oauth_return", "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect(`${clientUrl}${returnTo}?auth_error=auth_failed`);
  }
}
