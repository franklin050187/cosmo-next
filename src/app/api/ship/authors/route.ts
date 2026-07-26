import { NextResponse } from "next/server";
import { getAuthorsWithCounts } from "@/lib/db";

export async function GET() {
  const authors = await getAuthorsWithCounts();
  return NextResponse.json(authors);
}
