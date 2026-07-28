import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
  } catch (err) {
    console.error("collections/[id] GET error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
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

  if (process.env.NODE_ENV !== "development") {
    const turnstileToken = body["cf-turnstile-response"] || "";
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Turnstile verification failed" }, { status: 403 });
    }
  }

  try {
    const { updateCollection } = await import("@/lib/db");
    const result = await updateCollection(collectionId, payload.user.username, {
      title: body.title,
      description: body.description,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: result.error === "not the owner" ? 403 : 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("collections/[id] PUT error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
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

  try {
    const { deleteCollection } = await import("@/lib/db");
    const result = await deleteCollection(collectionId, payload.user.username);

    if ("error" in result) {
      return NextResponse.json(result, { status: result.error === "not the owner" ? 403 : 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("collections/[id] DELETE error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
