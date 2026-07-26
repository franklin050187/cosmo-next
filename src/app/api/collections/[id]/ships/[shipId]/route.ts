import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; shipId: string }> },
) {
  const payload = verifyRequest(_req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, shipId } = await params;
  const collectionId = parseInt(id, 10);
  const shipIdNum = parseInt(shipId, 10);
  if (isNaN(collectionId) || isNaN(shipIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { removeShipFromCollection } = await import("@/lib/db");
  const result = await removeShipFromCollection(
    collectionId,
    shipIdNum,
    payload.user.username,
  );

  if ("error" in result) {
    return NextResponse.json(result, {
      status: result.error === "not the owner" ? 403 : 404,
    });
  }
  return NextResponse.json(result);
}
