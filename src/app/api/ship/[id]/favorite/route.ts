import { NextRequest, NextResponse } from "next/server";
import { addToFavorites } from "@/lib/db";
import { verifyRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = verifyRequest(req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const shipId = parseInt(id, 10);
  if (isNaN(shipId)) {
    return NextResponse.json({ error: "Invalid ship ID" }, { status: 400 });
  }

  await addToFavorites(payload.user.username, shipId);
  return NextResponse.json({ success: true });
}
