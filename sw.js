/* 교육 사이트 웹판 서비스 워커(설계서 v0.2 4.5). 비공개 경로 요청을 가로채 로그인 토큰을 붙여
   비공개 버킷에서 받아 응답한다. 토큰은 메모리와 IndexedDB에만 둔다. 내용은 Cache API에 두지 않는다.
   이 파일을 바꿀 때마다 VERSION을 올린다. */
importScripts('shell/config.js', 'shell/paths.js');
var VERSION = 'edu-sw-3';
var C = self.EDU_CONFIG, P = self.EDU_PATHS;
var BASE = C.base;
var LOGIN = BASE + 'index.html', HOME_DENIED = BASE + 'home.html?e=denied';
var FETCH_MS = 20000;   /* 저장 공간 응답을 기다리는 한도. 넘으면 연결 끊김과 같게 본다 */
var memToken = null;

function idb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('edu-sw', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}
function idbGet(k) {
  return idb().then(function (d) {
    return new Promise(function (res, rej) {
      var q = d.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = function () { res(q.result || null); };
      q.onerror = function () { rej(q.error); };
    });
  });
}
function idbSet(k, v) {
  return idb().then(function (d) {
    return new Promise(function (res, rej) {
      var t = d.transaction('kv', 'readwrite');
      if (v === null) { t.objectStore('kv').delete(k); } else { t.objectStore('kv').put(v, k); }
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
    });
  });
}
function getToken() {
  if (memToken) { return Promise.resolve(memToken); }
  return idbGet('token').then(function (t) { memToken = t; return t; }, function () { return null; });
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* 화면에서 오는 메시지. 보낸 쪽 출처가 자기 출처일 때만 받는다(4.2). state는 참·거짓만 돌려준다 */
self.addEventListener('message', function (e) {
  var m = e.data || {}, port = e.ports && e.ports[0];
  if (e.origin !== self.location.origin) { return; }
  e.waitUntil((function () {
    if (m.type === 'token' && typeof m.token === 'string' && m.token.length > 0 && m.token.length < 16384) {
      memToken = m.token;
      return idbSet('token', m.token).then(function () { if (port) { port.postMessage({ ok: true }); } });
    }
    if (m.type === 'clear') {
      memToken = null;
      return idbSet('token', null).then(function () { if (port) { port.postMessage({ ok: true }); } });
    }
    if (m.type === 'state') {
      return idbGet('token').then(function (t) { if (port) { port.postMessage({ mem: !!memToken, idb: !!t }); } });
    }
    return Promise.resolve();
  })());
});

function login(req, url) {
  if (req.mode === 'navigate') { return Response.redirect(LOGIN + '?next=' + encodeURIComponent(url.pathname + url.search), 302); }
  return new Response('', { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
function denied(req) {
  if (req.mode === 'navigate') { return Response.redirect(HOME_DENIED, 302); }
  return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
function failed(req) {
  if (req.mode === 'navigate') {
    var html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><title>내용을 받지 못했습니다</title></head>' +
      '<body><main><h1>내용을 받지 못했습니다</h1><p>인터넷 연결을 확인하고 다시 열어 주세요.</p>' +
      '<p><a href="' + BASE + 'home.html">홈으로</a></p></main></body></html>';
    return new Response(html, { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  return new Response('', { status: 502, headers: { 'Cache-Control': 'no-store' } });
}

/* 4xx 본문은 앞 2KB까지만 읽는다. 판정에만 쓰고 저장하거나 내보내지 않는다 */
function readHead(r, max) {
  if (!r.body || !r.body.getReader) { return r.text().then(function (t) { return t.slice(0, max); }, function () { return ''; }); }
  var rd = r.body.getReader(), chunks = [], n = 0;
  function pump() {
    return rd.read().then(function (x) {
      if (x.done) { return; }
      chunks.push(x.value); n += x.value.length;
      if (n >= max) { rd.cancel().catch(function () {}); return; }
      return pump();
    });
  }
  return pump().then(function () {
    var b = new Uint8Array(Math.min(n, max)), o = 0;
    chunks.forEach(function (c) { var take = Math.min(c.length, b.length - o); if (take > 0) { b.set(c.subarray(0, take), o); o += take; } });
    return new TextDecoder('utf-8').decode(b);
  }, function () { return ''; });
}

/* 4xx 판정표(수1, 값은 13장 B6 실측으로 고정): 위에서부터 처음 맞는 줄. 'denied'(볼 수 없음 쪽) 또는 'login'(로그인 쪽).
   실측(2026-11-12): 없는 키·RLS가 막은 객체 = HTTP 400, 본문 statusCode "404"·error "not_found"·code "NoSuchKey" → 1번 줄.
   기한 지난·서명 깨진 토큰 = HTTP 400, 본문 statusCode "403"·error "Unauthorized"·code "AccessDenied" → 2번 줄 */
function classify4xx(status, text) {
  var j = null;
  try { j = JSON.parse(text); } catch (e) { j = null; }
  if (!j || typeof j !== 'object') { j = {}; }
  var f = function (k) { return j[k] === undefined || j[k] === null ? '' : String(j[k]); };
  if (status === 404 || ['not_found', 'NoSuchKey'].indexOf(f('error')) >= 0 || ['not_found', 'NoSuchKey'].indexOf(f('code')) >= 0 || f('statusCode') === '404') {
    return 'denied';
  }
  /* 2번 줄(그 밖): 1번에 맞지 않는 4xx는 토큰 꼴이든 판정 못 한 꼴이든 로그인 쪽이다(A7 리뷰 하5, B6에서 판정표도 이 두 줄로 정리).
     세션이 살아 있으면 곧바로 돌아오고, 되풀이되면 15초 가드가 멈춘다 */
  return 'login';
}

function handle(req, url, rel) {
  return getToken().then(function (token) {
    if (!token) { return login(req, url); }
    var k = P.storageKey(rel);
    if (!k.key) { return denied(req); }   /* 키 규칙 밖 경로: 버킷에 있을 수 없다 */
    if (!C.supabaseUrl) { return failed(req); }   /* 설정이 비면 토큰을 같은 출처로 보내지 않는다(A7 리뷰 수5) */
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, FETCH_MS);
    return fetch(C.supabaseUrl + '/storage/v1/object/authenticated/' + C.bucket + '/' + k.key, {
      headers: { 'Authorization': 'Bearer ' + token, 'apikey': C.publishableKey },
      cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: ctl.signal
    }).then(function (r) {
      if (r.status === 200) {
        return r.arrayBuffer().then(function (b) {
          clearTimeout(timer);
          return new Response(b, { status: 200, headers: { 'Content-Type': P.contentType(rel), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        });
      }
      if (r.status >= 400 && r.status < 500) {
        return readHead(r, 2048).then(function (t) {
          clearTimeout(timer);
          return classify4xx(r.status, t) === 'denied' ? denied(req) : login(req, url);
        });
      }
      clearTimeout(timer);
      return failed(req);   /* 5xx, 넘겨주기, 그 밖 */
    }, function () { clearTimeout(timer); return failed(req); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) { return; }
  var rel = P.privateRel(url.pathname, BASE);
  if (!rel) { return; }
  e.respondWith(handle(req, url, rel).catch(function () { return failed(req); }));
});
