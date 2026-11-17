// 오프라인 저장용 서비스 워커. 설정의 "오프라인 저장"을 켰을 때만 등록된다(src/components/OfflineManager.tsx).
// 원칙: 항상 네트워크가 먼저(온라인에서는 평소와 똑같이 최신 내용), 실패했을 때만 저장해 둔 사본을 쓴다.
// - 화면·스크립트·이미지·GET API: 받은 응답을 저장해 두고, 네트워크가 안 되면 그 사본을 돌려준다.
// - POST /api/wordlist/*: 요청 본문(고른 단어장 조합)별로 응답을 저장 → 같은 단어장을 오프라인에서 다시 열 수 있다.
// - POST /api/furigana: 문장 하나하나의 결과를 따로 저장 → 오프라인에서도 본 적 있는 문장은 팝업이 뜬다.
// 기록을 바꾸는 요청(단어장 추가 등)과 다른 사이트(Supabase 등)로 가는 요청은 건드리지 않는다.
const CACHE = "word-app-offline-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// GET: 네트워크 우선, 실패하면 사본. RSC(화면 조각) 요청은 주소에 붙는 _rsc 값이 매번 달라 따로 구분해 저장한다.
async function handleGet(request) {
  const url = new URL(request.url);
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  url.searchParams.delete("_rsc");
  const key = new Request(url.pathname + url.search + (isRsc ? (url.search ? "&" : "?") + "__rsc=1" : ""));
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(key)) || (request.mode === "navigate" ? await cache.match(new Request(url.pathname)) : null);
    if (hit) return hit;
    throw err;
  }
}

// POST(읽기 전용 API): 본문별로 저장
async function handlePostByBody(request) {
  const body = await request.clone().text();
  const key = new Request(new URL(request.url).pathname + "?__body=" + (await sha(body)));
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw err;
  }
}

// POST /api/furigana: { texts } → { results }. 문장별로 저장하고, 오프라인이면 문장별 사본으로 응답을 조립한다.
async function handleFurigana(request) {
  const body = await request.clone().text();
  let texts = [];
  try {
    texts = JSON.parse(body).texts ?? [];
  } catch {
    return fetch(request);
  }
  const cache = await caches.open(CACHE);
  const keyOf = async (text) => new Request("/__furi/" + (await sha(text)));
  try {
    const res = await fetch(request);
    if (res.ok) {
      const data = await res.clone().json();
      await Promise.all(texts.map(async (text, i) => data.results?.[i] && cache.put(await keyOf(text), json(data.results[i]))));
    }
    return res;
  } catch {
    // 저장해 둔 적 없는 문장은 팝업 없이 글자만 보이게 한다.
    const results = await Promise.all(
      texts.map(async (text) => {
        const hit = await cache.match(await keyOf(text));
        return hit ? hit.json() : [{ s: text, r: null }];
      })
    );
    return json({ results });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === "GET") event.respondWith(handleGet(request));
  else if (request.method === "POST" && url.pathname === "/api/furigana") event.respondWith(handleFurigana(request));
  else if (request.method === "POST" && url.pathname.startsWith("/api/wordlist/")) event.respondWith(handlePostByBody(request));
});
