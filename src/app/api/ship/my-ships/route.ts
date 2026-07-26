import { NextRequest, NextResponse } from "next/server";
import { getMyShips } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = verifyRequest(req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getMyShips(payload.user.username);
  return NextResponse.json(result);
}
