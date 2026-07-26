import { NextResponse } from "next/server";
import { getTagsWithCounts } from "@/lib/db";

export async function GET() {
  const tags = await getTagsWithCounts();
  return NextResponse.json(tags);
}
