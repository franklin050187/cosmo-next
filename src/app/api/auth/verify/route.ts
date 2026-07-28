import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const payload = verifyRequest(req);
  return NextResponse.json({ valid: !!payload?.user });
}
