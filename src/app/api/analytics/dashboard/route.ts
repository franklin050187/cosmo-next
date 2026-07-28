import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/analytics-db";

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.user as { id: string; username: string } | undefined;
    } catch {}
  }
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || !ADMIN_USERNAMES.includes(user.username)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("analytics/dashboard error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
