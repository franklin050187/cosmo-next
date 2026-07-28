import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function GET(req: NextRequest) {
  const payload = verifyRequest(req);
  const username = payload?.user?.username;
  return NextResponse.json({ isAdmin: !!username && ADMIN_USERNAMES.includes(username) });
}
