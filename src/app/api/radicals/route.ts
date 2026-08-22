import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getFileContent, uploadTextToGithub } from "@/lib/github";
import { RadicalLibrary } from "@/lib/types";
import { RADICAL_SEED } from "@/lib/radicalSeed";

export const revalidate = 300;

const RADICAL_PATH = "resources/radicals.json";

function checkPassword(input: string): boolean {
  const correct = process.env.UPLOAD_PASSWORD || "";
  if (!correct) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(correct);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function loadLibrary(): Promise<RadicalLibrary> {
  const raw = await getFileContent(RADICAL_PATH);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveLibrary(library: RadicalLibrary): Promise<boolean> {
  const text = JSON.stringify(library, null, 2);
  const result = await uploadTextToGithub("resources", "radicals.json", text);
  return result.ok;
}

export async function GET() {
  const library = await loadLibrary();
  return NextResponse.json({ library });
}

// 글자 하나 추가/수정
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { char: string; reading: string; desc: string; password: string };
  if (!checkPassword(body.password || "")) {
    return NextResponse.json({ ok: false, error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const char = (body.char || "").trim();
  if (!char) return NextResponse.json({ ok: false, error: "한자를 입력해주세요." }, { status: 400 });

  const library = await loadLibrary();
  library[char] = { reading: (body.reading || "").trim(), desc: (body.desc || "").trim() };
  const ok = await saveLibrary(library);
  if (!ok) return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 502 });
  return NextResponse.json({ ok: true, library });
}

// 214개 세트 일괄 로드 (기존 값 우선, 없는 것만 채움)
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { password: string };
  if (!checkPassword(body.password || "")) {
    return NextResponse.json({ ok: false, error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const library = await loadLibrary();
  const merged: RadicalLibrary = { ...RADICAL_SEED, ...library };
  const ok = await saveLibrary(merged);
  if (!ok) return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 502 });
  return NextResponse.json({ ok: true, library: merged });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { char: string; password: string };
  if (!checkPassword(body.password || "")) {
    return NextResponse.json({ ok: false, error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const library = await loadLibrary();
  delete library[body.char];
  const ok = await saveLibrary(library);
  if (!ok) return NextResponse.json({ ok: false, error: "삭제에 실패했습니다." }, { status: 502 });
  return NextResponse.json({ ok: true, library });
}
