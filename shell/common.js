/* 교육 사이트 웹판 공통(설계서 v0.2 4장). 겉틀 화면 6개와 웹용 겉틀.js(과정 첫 화면·차시)가 함께 쓴다.
   앞에 shell/config.js, lib/supabase.js, shell/paths.js가 불려 있어야 한다.
   하는 일: 클라이언트 만들기, 서비스 워커 연결, 토큰 전달, 화면 가드, pageshow 보호, 로그아웃,
   남은 진도 보내기, 진도 다시 쓰기, 차시목록 읽기. 토큰·비밀번호를 화면·콘솔·저장소에 따로 남기지 않는다. */
(function () {
  'use strict';
  var C = self.EDU_CONFIG, P = self.EDU_PATHS;
  var BASE = C.base;
  var COURSES = ['basic', 'advanced'];
  var PENDING = 'edu.pending';
  var LS = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }

  var TEXT = {
    loading: '불러오는 중입니다.',
    net: '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.',
    lost: '로그인이 끊겼습니다. 다시 로그인해 주세요.',
    noSw: '이 브라우저에서는 교육 내용을 열 수 없습니다. Edge나 Chrome의 일반 창으로 열어 주세요.'
  };

  /* ── localStorage의 supabase 세션 항목. 이름을 AUTH_KEY 하나로 고정한다(같은 출처의 다른 supabase 앱 세션과 섞이지 않게).
     겉틀_덧붙임.js에도 같은 이름이 있다. 클라이언트를 기다리지 않고 바로 읽는다 ── */
  var AUTH_KEY = 'edu.auth';
  function sessionKey() {
    if (!LS) { return null; }
    try { return LS.getItem(AUTH_KEY) !== null ? AUTH_KEY : null; } catch (e) { return null; }
  }
  function sessionRaw() {
    var k = sessionKey();
    if (!k) { return null; }
    try { var v = JSON.parse(LS.getItem(k)); return v && typeof v === 'object' ? (v.currentSession || v) : null; } catch (e) { return null; }
  }
  function sessionUserId() { var s = sessionRaw(); return s && s.user && s.user.id ? s.user.id : null; }
  function sessionToken() { var s = sessionRaw(); return s && s.access_token ? s.access_token : null; }

  /* ── 뒤로 가기 보호(대책 B, 4.11): 기억된 화면으로 돌아왔는데 세션 항목이 없으면 로그인으로 ── */
  function guardPageshow() {
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && !sessionKey()) { location.replace(BASE + 'index.html'); }
    });
  }

  /* ── 클라이언트 ── */
  var client = null;
  function sb() {
    if (!client) {
      client = self.supabase.createClient(C.supabaseUrl, C.publishableKey, {
        auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
    return client;
  }
  function timeout(ms) { return (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(ms) : undefined; }

  /* ── 서비스 워커(4.1 4번, 4.2) ── */
  var swReady = null;
  function registerSW() {
    if (!swReady) {
      if (!('serviceWorker' in navigator)) { swReady = Promise.reject(new Error('no-sw')); }
      else {
        swReady = navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).then(function () {
          return navigator.serviceWorker.ready;
        });
      }
      swReady.catch(function () {});
    }
    return swReady;
  }
  function sendSW(msg) {
    return registerSW().then(function (reg) {
      return new Promise(function (resolve, reject) {
        var ch = new MessageChannel();
        var t = setTimeout(function () { reject(new Error('sw-timeout')); }, 4000);
        ch.port1.onmessage = function (e) { clearTimeout(t); resolve(e.data); };
        (reg.active || navigator.serviceWorker.controller).postMessage(msg, [ch.port2]);
      });
    });
  }
  function passToken(session) {
    if (!session || !session.access_token) { return Promise.reject(new Error('no-session')); }
    return sendSW({ type: 'token', token: session.access_token });
  }
  /* 상태 알림 처리기 안에서는 토큰 건네기만 한다(다른 supabase 호출을 기다리지 않음, 4.2) */
  var watching = false;
  function watchToken() {
    if (watching) { return; }
    watching = true;
    sb().auth.onAuthStateChange(function (event, session) {
      if (session && session.access_token) { sendSW({ type: 'token', token: session.access_token }).catch(function () {}); }
      else if (event === 'SIGNED_OUT') { sendSW({ type: 'clear' }).catch(function () {}); }
    });
  }

  function getSession() {
    return sb().auth.getSession().then(function (r) { return r && r.data ? r.data.session : null; }, function () { return null; });
  }

  /* ── RPC ── */
  function rpc(name, args, ms) {
    var q = sb().rpc(name, args || {});
    var s = timeout(ms || 10000);
    if (s) { q = q.abortSignal(s); }
    return Promise.resolve(q).then(function (r) { return r; }, function (e) { return { data: null, error: { message: String(e) }, status: 0 }; });
  }
  /* edu_me(): {ok:true,row|null} 또는 {ok:false}(연결 실패) */
  function me() {
    return rpc('edu_me').then(function (r) {
      if (r.error) { return { ok: false, status: r.status }; }
      var row = Array.isArray(r.data) ? (r.data[0] || null) : (r.data || null);
      return { ok: true, row: row };
    });
  }
  function allowedCourses(row) {
    if (!row) { return []; }
    if (row.role === 'instructor') { return COURSES.slice(); }
    return COURSES.filter(function (c) { return (row.courses || []).indexOf(c) >= 0; });
  }

  /* ── 주소 ── */
  function here() { return location.pathname + location.search; }
  function loginUrl(next, hash) {
    return BASE + 'index.html' + (next ? '?next=' + encodeURIComponent(next) : '') + (hash || '');
  }
  function toLogin() { location.replace(loginUrl(here(), location.hash)); }
  function safeNext(n) {
    if (!n || typeof n !== 'string' || n.length > 500) { return null; }
    if (n.indexOf(BASE) !== 0 || n.indexOf('//') >= 0 || n.indexOf('\\') >= 0 || n.indexOf(':') >= 0) { return null; }
    return n;
  }
  function safeHash(h) { return /^#\d{1,3}$/.test(h || '') ? h : ''; }

  /* ── 남은 진도 표시 edu.pending(4.9 표) ── */
  function pendingRead() {
    if (!LS) { return []; }
    var v = LS.getItem(PENDING);
    if (!v) { return []; }
    try { var a = JSON.parse(v); if (Array.isArray(a)) { return a.filter(function (x) { return x && typeof x === 'object'; }); } } catch (e) {}
    try { LS.removeItem(PENDING); } catch (e) {}
    return [];
  }
  function pendingWrite(arr, rawSet) {
    if (!LS) { return; }
    try {
      if (!arr.length) { LS.removeItem(PENDING); return; }
      (rawSet || Storage.prototype.setItem).call(LS, PENDING, JSON.stringify(arr));
    } catch (e) {}
  }
  function same(a, b) { return a.u === b.u && a.c === b.c && a.id === b.id; }
  function pendingRemove(item, rawSet) {
    pendingWrite(pendingRead().filter(function (x) { return !same(x, item); }), rawSet);
  }

  function localRec(course, id) {
    var pfx = C.stores[course];
    if (!pfx || !LS) { return null; }
    try {
      var all = JSON.parse(LS.getItem(pfx + 'progress') || 'null');
      var r = all && typeof all === 'object' ? all[id] : null;
      return r && typeof r === 'object' ? r : null;
    } catch (e) { return null; }
  }

  /* 차시 기록 하나 보내기(4.9 5번). 성공 true. 토큰 문제면 갱신 뒤 한 번만 다시 */
  function saveRow(course, id, rec, n) {
    n = Math.max(1, Math.min(200, n | 0));
    var last = typeof rec.last === 'number' ? Math.round(rec.last) : 1;
    last = Math.max(1, Math.min(n, last));
    var checks = (Array.isArray(rec.checks) ? rec.checks : []).map(function (x) { return x === 1 ? 1 : 0; });
    var args = { p_course: course, p_lesson_id: id, p_last_slide: last, p_slide_count: n, p_checks: checks };
    function once() { return rpc('edu_save_progress', args, 4000); }
    return once().then(function (r) {
      if (!r.error) { return true; }
      if (r.status === 401) {
        return sb().auth.refreshSession().then(once, function () { return { error: true }; }).then(function (r2) { return !r2.error; });
      }
      return false;
    });
  }

  /* 남은 진도 보내기(4.9 7번). opts.course: 그 과정만, opts.skip: {c,id} 이 차시는 건드리지 않음.
     돌려줌: 보내지 못한 [{c,id}] */
  function flushPending(opts) {
    opts = opts || {};
    return getSession().then(function (s) {
      var u = s && s.user ? s.user.id : null;
      var items = pendingRead();
      var failed = [];
      var chain = Promise.resolve();
      items.forEach(function (it) {
        chain = chain.then(function () {
          if (!u || it.u !== u) { pendingRemove(it, opts.rawSet); return; }   // 다른 사용자 항목은 보내지 않고 지운다
          if (opts.course && it.c !== opts.course) { return; }
          if (opts.skip && it.c === opts.skip.c && it.id === opts.skip.id) { return; }
          var rec = localRec(it.c, it.id);
          if (!rec || COURSES.indexOf(it.c) < 0) { pendingRemove(it, opts.rawSet); return; }
          return saveRow(it.c, it.id, rec, it.n).then(function (ok) {
            if (ok) { pendingRemove(it, opts.rawSet); } else { failed.push({ c: it.c, id: it.id }); }
          });
        });
      });
      return chain.then(function () { return failed; });
    });
  }

  /* 자기 진도 읽기(4.7 4번). 실패면 null */
  function readOwnProgress(uid, course) {
    var q = sb().from('edu_progress').select('course,lesson_id,last_slide,max_slide,slide_count,checks,updated_at').eq('user_id', uid);
    if (course) { q = q.eq('course', course); }
    var s = timeout(10000);
    if (s) { q = q.abortSignal(s); }
    return Promise.resolve(q).then(function (r) { return r.error ? null : (r.data || []); }, function () { return null; });
  }

  /* localStorage 다시 쓰기(4.7 5번). courses: 지우고 다시 쓸 과정. failed: 서버 값 대신 이 PC 기록을 남길 차시 */
  function rewriteLocal(rows, failed, courses) {
    if (!LS) { return; }
    courses.forEach(function (c) {
      var pfx = C.stores[c];
      var keep = {};
      (failed || []).forEach(function (f) { if (f.c === c) { var r = localRec(c, f.id); if (r) { keep[f.id] = r; } } });
      var del = [];
      for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k && k.indexOf(pfx) === 0) { del.push(k); } }
      del.forEach(function (k) { try { LS.removeItem(k); } catch (e) {} });
      var prog = {}, last = null;
      rows.filter(function (r) { return r.course === c; }).forEach(function (r) {
        prog[r.lesson_id] = { checks: (r.checks || []).map(Number), last: r.last_slide };
        if (!last || String(r.updated_at) > String(last.updated_at)) { last = r; }
      });
      Object.keys(keep).forEach(function (id) { prog[id] = keep[id]; });
      try {
        if (Object.keys(prog).length) { LS.setItem(pfx + 'progress', JSON.stringify(prog)); }
        if (last) { LS.setItem(pfx + 'last', JSON.stringify({ id: last.lesson_id, slide: last.last_slide })); }
      } catch (e) {}
    });
  }
  /* 로그인·홈·마이페이지: 남은 진도 먼저 보내고 두 앞말 모두 서버 값으로. 돌려줌: 읽은 행(실패면 null) */
  function syncAll(uid) {
    return flushPending().then(function (failed) {
      return readOwnProgress(uid).then(function (rows) {
        if (rows) { rewriteLocal(rows, failed, COURSES); }
        return rows;
      });
    });
  }

  /* ── 로그아웃(4.11) ── */
  function clearLocal() {
    if (!LS) { return; }
    var del = [];
    for (var i = 0; i < LS.length; i++) {
      var k = LS.key(i);
      if (!k) { continue; }
      if (k === PENDING || k === AUTH_KEY) { del.push(k); continue; }
      COURSES.forEach(function (c) { if (k.indexOf(C.stores[c]) === 0) { del.push(k); } });
    }
    del.forEach(function (k) { try { LS.removeItem(k); } catch (e) {} });
  }
  function logout(reason) {
    var done = function () {
      clearLocal();
      document.cookie = 'edu_out=' + Date.now() + '; path=' + BASE + '; SameSite=Lax; Secure';
      location.replace(BASE + 'index.html' + (reason ? '?m=' + reason : ''));
    };
    return flushPending().catch(function () {})
      .then(function () { return sb().auth.signOut({ scope: 'local' }).catch(function () {}); })
      .then(function () { return sendSW({ type: 'clear' }).catch(function () {}); })
      .then(done, done);
  }

  /* ── 화면 가드(4.1 6번). kind: password·home·me·admin. 돌려줌 {session,row} 또는 null(다른 곳으로 보냄·오류 표시) ── */
  function screenGuard(kind, opts) {
    opts = opts || {};
    return getSession().then(function (s) {
      if (!s) { if (kind === 'password') { location.replace(BASE + 'index.html'); } else { toLogin(); } return null; }
      return me().then(function (m) {
        if (!m.ok) { showMsg(TEXT.net, 'err'); return null; }
        var row = m.row;
        if (!row || row.role === 'uploader' || (row.role !== 'student' && row.role !== 'instructor')) { logout('unusable'); return null; }
        if (!row.active) { logout('banned'); return null; }
        if (kind === 'password') {
          if (!row.must_change_pw && !opts.fromMe) { location.replace(BASE + 'home.html'); return null; }
        } else if (row.must_change_pw) {
          /* 홈은 바꾼 뒤 기본으로 가는 곳이라 돌아올 주소를 붙이지 않는다(볼 수 없음 쪽에서 온 ?e=denied를 끌고 가지 않기 위해) */
          location.replace(BASE + 'password.html' + (kind === 'home' ? '' : '?next=' + encodeURIComponent(here() + location.hash)));
          return null;
        }
        return { session: s, row: row };
      });
    });
  }

  /* ── 화면 도우미 ── */
  function el(id) { return document.getElementById(id); }
  function showMsg(text, cls) {
    var m = el('status');
    if (!m) { return; }
    m.textContent = text;
    m.className = 'msg' + (cls ? ' ' + cls : '');
    m.hidden = !text;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /* 위 줄: <아이디> · 홈 · 마이페이지 · 강사 화면(강사만) · 로그아웃 */
  function renderNav(row) {
    var nav = el('nav');
    if (!nav) { return; }
    var parts = ['<span class="who">' + esc(row.login_id) + '</span>',
      '<a href="' + BASE + 'home.html">홈</a>', '<a href="' + BASE + 'me.html">마이페이지</a>'];
    if (row.role === 'instructor') { parts.push('<a href="' + BASE + 'admin.html">강사 화면</a>'); }
    parts.push('<button type="button" id="logoutBtn">로그아웃</button>');
    nav.innerHTML = parts.join('<span class="sep" aria-hidden="true">·</span>');
    el('logoutBtn').addEventListener('click', function () { logout(); });
  }
  function allDone(checks) {
    if (!checks || !checks.length) { return false; }
    for (var i = 0; i < checks.length; i++) { if (Number(checks[i]) !== 1) { return false; } }
    return true;
  }
  /* 차시목록.js 읽기(4.7 2번). 과정마다 차례로 <script>로 부르고 window.EDU_SITE를 옮긴 뒤 지운다 */
  function loadList(course) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = BASE + course + '/공용/차시목록.js';
      try { delete window.EDU_SITE; } catch (e) { window.EDU_SITE = undefined; }
      s.onload = function () { var v = window.EDU_SITE || null; try { delete window.EDU_SITE; } catch (e) { window.EDU_SITE = undefined; } s.remove(); resolve(v); };
      s.onerror = function () { s.remove(); resolve(null); };
      document.head.appendChild(s);
    });
  }
  function loadLists(courses) {
    var out = {};
    return courses.reduce(function (p, c) {
      return p.then(function () { return loadList(c).then(function (v) { out[c] = v; }); });
    }, Promise.resolve()).then(function () { return out; });
  }
  /* 과정 하나의 진행 숫자(4.7 6번). prog: {차시 id: {checks,last}}, last: {id,slide} */
  function courseStats(site, prog, last) {
    var ready = site.lessons.filter(function (l) { return l.ready; });
    var done = ready.filter(function (l) { return prog[l.id] && allDone(prog[l.id].checks); });
    var rl = null;
    if (last && last.id) { ready.forEach(function (l) { if (l.id === last.id) { rl = l; } }); }
    return { n: done.length, m: ready.length, pct: ready.length ? Math.round(done.length * 100 / ready.length) : 0,
      done: done, resume: (rl && last.slide >= 1) ? { lesson: rl, slide: last.slide } : null };
  }
  function localProgress(course) {
    var pfx = C.stores[course], prog = {}, last = null;
    if (LS) {
      try { prog = JSON.parse(LS.getItem(pfx + 'progress') || '{}') || {}; } catch (e) { prog = {}; }
      try { last = JSON.parse(LS.getItem(pfx + 'last') || 'null'); } catch (e) { last = null; }
    }
    if (typeof prog !== 'object' || Array.isArray(prog)) { prog = {}; }
    return { prog: prog, last: last };
  }

  /* 화면 공통 시작(4.1 2~5번). 서비스 워커를 못 쓰면 문구를 보인다 */
  function start(opts) {
    opts = opts || {};
    registerSW().catch(function () { if (!opts.quietSw) { showMsg(TEXT.noSw, 'err'); } });
    watchToken();
  }

  guardPageshow();

  window.EDU = {
    C: C, BASE: BASE, COURSES: COURSES, TEXT: TEXT,
    sb: sb, start: start, registerSW: registerSW, sendSW: sendSW, passToken: passToken, watchToken: watchToken,
    getSession: getSession, me: me, rpc: rpc, allowedCourses: allowedCourses,
    loginUrl: loginUrl, toLogin: toLogin, safeNext: safeNext, safeHash: safeHash,
    sessionKey: sessionKey, sessionUserId: sessionUserId, sessionToken: sessionToken,
    pendingRead: pendingRead, pendingWrite: pendingWrite, pendingRemove: pendingRemove,
    localRec: localRec, saveRow: saveRow, flushPending: flushPending, readOwnProgress: readOwnProgress,
    rewriteLocal: rewriteLocal, syncAll: syncAll, logout: logout, screenGuard: screenGuard,
    el: el, showMsg: showMsg, esc: esc, renderNav: renderNav, allDone: allDone,
    loadList: loadList, loadLists: loadLists, courseStats: courseStats, localProgress: localProgress
  };
})();
