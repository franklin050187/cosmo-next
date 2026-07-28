import { NextRequest, NextResponse } from "next/server";

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ isAdmin: false });
  }
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split(".")[1]));
    const username = payload.user?.username as string | undefined;
    return NextResponse.json({ isAdmin: !!username && ADMIN_USERNAMES.includes(username) });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
