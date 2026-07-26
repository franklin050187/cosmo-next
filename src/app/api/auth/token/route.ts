import { NextResponse } from "next/server";
import { generateToken } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ token: generateToken() });
}
