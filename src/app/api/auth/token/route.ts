import { NextRequest, NextResponse } from "next/server";
import { generateToken, verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const payload = verifyRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token: generateToken() });
}
