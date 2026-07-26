import { NextRequest, NextResponse } from "next/server";
import { updateDownloads } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shipId = parseInt(id, 10);
  if (isNaN(shipId)) {
    return NextResponse.json({ error: "Invalid ship ID" }, { status: 400 });
  }

  await updateDownloads(shipId);
  return NextResponse.json({ success: true });
}
