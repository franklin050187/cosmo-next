import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { getCollection } = await import("@/lib/db");
  const col = await getCollection(collectionId);
  if (!col) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(col);
}

export async function PUT(
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
  const { updateCollection } = await import("@/lib/db");
  const result = await updateCollection(collectionId, payload.user.username, {
    title: body.title,
    description: body.description,
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.error === "not the owner" ? 403 : 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const payload = verifyRequest(_req);
  if (!payload?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { deleteCollection } = await import("@/lib/db");
  const result = await deleteCollection(collectionId, payload.user.username);

  if ("error" in result) {
    return NextResponse.json(result, { status: result.error === "not the owner" ? 403 : 404 });
  }
  return NextResponse.json(result);
}
