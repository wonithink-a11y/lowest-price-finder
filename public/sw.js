const CACHE_NAME = "price-finder-shell-v3";
const SHELL_ASSETS = ["/", "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  // 하나라도 실패하면 설치 전체가 실패하는 cache.addAll 대신 개별 추가
  // (비밀번호 설정 시 "/"는 로그인 전 리다이렉트되므로 실패할 수 있다)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL_ASSETS.map((u) => cache.add(u).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// API 응답(/api/*)은 캐시하지 않는다 — 가격은 항상 최신 요청이어야 한다.
// 그 외 GET은 네트워크 우선, 오프라인일 때만 캐시 폴백 (cache-first면 재배포 후에도 옛 화면이 남는다).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/login") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 로그인 리다이렉트 등은 캐시하지 않는다
        if (res.ok && !res.redirected && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});
