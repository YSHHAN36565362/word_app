import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { uploadTextToGithub } from "@/lib/github";
import { parseWordsWithValidation, makeSafeFilename } from "@/lib/parser";

function checkPassword(input: string): boolean {
  const correct = process.env.UPLOAD_PASSWORD || "";
  if (!correct) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(correct);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    targetFolder: string;
    title: string;
    content: string;
    password: string;
  };

  if (!checkPassword(body.password || "")) {
    return NextResponse.json({ ok: false, error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const { words, errors } = parseWordsWithValidation(body.content || "");
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: "형식 오류", errors }, { status: 400 });
  }
  if (words.length === 0) {
    return NextResponse.json({ ok: false, error: "저장할 단어가 없습니다." }, { status: 400 });
  }

  const safeName = makeSafeFilename(body.title || "");
  const result = await uploadTextToGithub(body.targetFolder, safeName, body.content);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: `업로드 실패 (status ${result.status}): ${result.message ?? ""}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, path: result.path, count: words.length });
}
