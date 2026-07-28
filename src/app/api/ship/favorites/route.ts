import { NextRequest, NextResponse } from "next/server";
import { getMyFavorites } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = verifyRequest(req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getMyFavorites(payload.user.username);
    return NextResponse.json(result);
  } catch (err) {
    console.error("ship/favorites error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
