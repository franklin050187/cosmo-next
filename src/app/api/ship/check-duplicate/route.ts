import { NextResponse } from "next/server";
import { findDuplicateBySignature } from "@/lib/db";
import { decodePngPixels, decodeShipFromPixels } from "@/lib/server-decode";
import { computeShipSignature } from "@/lib/ship-signature";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }

      const arrayBuf = await file.arrayBuffer();
      const imageData = decodePngPixels(arrayBuf);
      const shipData = decodeShipFromPixels(imageData);
      const signature = computeShipSignature(shipData);
      const duplicates = await findDuplicateBySignature(signature);
      return NextResponse.json({ duplicates, signature });
    }

    const body = await req.json();
    const { signature } = body;
    if (!signature || typeof signature !== "string") {
      return NextResponse.json({ error: "signature required" }, { status: 400 });
    }
    const duplicates = await findDuplicateBySignature(signature);
    return NextResponse.json({ duplicates });
  } catch {
    return NextResponse.json({ duplicates: [] });
  }
}
