import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const payload = verifyRequest(req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const shipId = body.shipId;
  if (typeof shipId !== "number") {
    return NextResponse.json({ error: "shipId required" }, { status: 400 });
  }

  const { addShipToCollection } = await import("@/lib/db");
  const result = await addShipToCollection(collectionId, shipId, payload.user.username);

  if ("error" in result) {
    return NextResponse.json(result, {
      status: result.error === "not the owner" ? 403 : 404,
    });
  }
  return NextResponse.json(result);
}
