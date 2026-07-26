import { NextRequest, NextResponse } from "next/server";
import { searchFromQueryString } from "@/lib/db";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams.toString();
  const result = await searchFromQueryString(searchParams);
  return NextResponse.json(result);
}
