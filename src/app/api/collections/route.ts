import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const shipId = req.nextUrl.searchParams.get("shipId");

  if (shipId) {
    const shipIdNum = parseInt(shipId, 10);
    if (isNaN(shipIdNum)) {
      return NextResponse.json({ data: [] });
    }
    const { getCollectionsForShip } = await import("@/lib/db");
    const data = await getCollectionsForShip(shipIdNum);
    return NextResponse.json({ data });
  }

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1;
  const { getAllCollections } = await import("@/lib/db");
  const data = await getAllCollections(page);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const payload = verifyRequest(req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { createCollection } = await import("@/lib/db");
  const result = await createCollection(
    payload.user.username,
    title,
    body.description?.trim() ?? "",
  );

  return NextResponse.json(result, { status: 201 });
}
