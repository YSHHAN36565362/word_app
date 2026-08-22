import { NextResponse } from "next/server";

export const revalidate = 300;

/**
 * 브라우저에서 Supabase 클라이언트를 만들 때 필요한 URL/anon key를 알려준다.
 *
 * 왜 이게 필요한가: Next.js는 빌드 시점에 `NEXT_PUBLIC_`으로 시작하는 환경변수만
 * 클라이언트 번들에 심어준다. 그 외 이름(예: Vercel의 Supabase Integration이 프로젝트에
 * 따라 `STORAGE_NEXT_PUBLIC_SUPABASE_URL`처럼 접두사를 붙여 저장하는 경우)은 브라우저
 * 코드에서 `process.env.그이름`을 아무리 참조해도 항상 undefined다 — 클라이언트 쪽
 * "fallback" 코드로는 애초에 해결할 수 없고, 서버에서 읽어 내려줘야 한다.
 *
 * anon key는 원래 공개해도 되는 값(RLS로 보호)이므로 여기서 내려줘도 안전하다.
 * SERVICE_ROLE/SECRET 계열 키는 절대 여기 포함하지 않는다.
 */
export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.STORAGE_NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.STORAGE_SUPABASE_URL ||
    "";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.STORAGE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.STORAGE_SUPABASE_KEY ||
    "";

  return NextResponse.json({ supabaseUrl: url, supabaseAnonKey: anonKey });
}
