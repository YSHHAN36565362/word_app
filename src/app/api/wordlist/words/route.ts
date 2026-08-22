import { NextRequest, NextResponse } from "next/server";
import { getFileContent } from "@/lib/github";
import { buildWordPool } from "@/lib/parser";

export const revalidate = 300;

export async function POST(req: NextRequest) {
  const { paths } = (await req.json()) as { paths: string[] };
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ words: [] });
  }
  const texts = await Promise.all(paths.map((p) => getFileContent(p)));
  const words = buildWordPool(texts);
  return NextResponse.json({ words });
}
