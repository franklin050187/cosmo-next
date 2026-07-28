import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = verifyRequest(req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getUserCollections } = await import("@/lib/db");
    const data = await getUserCollections(payload.user.username);
    return NextResponse.json(data);
  } catch (err) {
    console.error("collections/mine error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
