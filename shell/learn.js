/* 수강 화면(디자인 개편 설계서 v0.1 2.5·3장, 개발실장 재리뷰 2회차 구현 지시).
   가운데 액자에 차시 HTML을 그대로 연다. 액자 주소는 주소 값이 아니라 차시목록에서 찾은 항목으로 만든다(3.2).
   액자 안 문서는 읽기만 한다(B32). 3.1 8번 뒤로는 진도 항목을 쓰지 않는다(U27).
   실습자료 목록 읽기·키 되돌리기·거르기·받기 처리기는 home.js와 같은 글자다(B30). */
(function () {
  'use strict';
  var E = window.EDU, el = E.el, esc = E.esc, P = window.EDU_PATHS;
  var BASE = E.BASE;
  var LS = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }
  var TEXT = {
    listFail: '이 과정의 목록을 읽지 못했습니다. 잠시 뒤 다시 열어 주세요.',
    saveOk: '진도는 로그인한 계정에 저장됩니다. 다른 PC에서 로그인해도 이어집니다.',
    saveLocal: '서버에서 진도를 받지 못해 이 PC에 남은 진도를 보여 줍니다.'
  };
  var FILES_TEXT = {
    fail: '실습자료 목록을 읽지 못했습니다. 접었다가 다시 펼쳐 주세요.',
    none: '이 차시에는 받을 실습자료가 없습니다.'
  };
  var STXT = { done: '마침', doing: '보는 중', none: '안 봄' };
  var LESSON_RE = /^(basic|advanced)\/차시\/(.+)\.html$/;
  var RELOAD_KEY = 'edu.learnReload';

  /* 2. 주소 읽기: c·id는 URLSearchParams의 첫 값, 장은 E.safeHash */
  var q = new URLSearchParams(location.search);
  var c = q.get('c'), id = q.get('id');
  var hash = E.safeHash(location.hash);

  var site = null, lessons = [], cur = null, rows = null, frame = null, deckTotal = 0;
  var openStages = null;

  /* ── 주소 만들기 ── */
  /* 수강 화면 주소는 이 한 꼴로 만든다(3.5 ③ 수2): 경로 꼴, 같은 차시면 늘 같은 글자 */
  function learnUrl(lid) { return BASE + 'learn.html?c=' + c + (lid ? '&id=' + encodeURIComponent(lid) : ''); }
  /* 장 번호(3.2 ③ 수4·문1): 1~999의 정수일 때만 '#' + n. 주소의 장은 E.safeHash를 통과한 값의 # 뒤 숫자 */
  function slideHash(n) { n = Number(n); return (Math.floor(n) === n && n >= 1 && n <= 999) ? '#' + n : ''; }
  function slideOfHash(h) { h = E.safeHash(h); return h ? Number(h.slice(1)) : 0; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  /* 차시목록에서 id가 글자 그대로 같은 항목(배열을 돌며 비교한다. 객체 키로 찾지 않는다) */
  function findLesson(lid) {
    for (var i = 0; i < lessons.length; i++) { if (lessons[i] && lessons[i].id === lid) { return lessons[i]; } }
    return null;
  }
  /* 3.2 ② 글자 조건 */
  function idShapeOk(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 100 && v !== '.' && v !== '..' &&
      !/[\/\\?#%\u0000-\u001f\u007f-\u009f]/.test(v);
  }
  /* 3.2 ③ 액자 주소. 항목의 id로 만들고, 같은 출처·BASE 아래·privateRel 판정이 <c>/차시/<id>.html일 때만 돌려준다 */
  function frameUrl(l, n) {
    if (!l || !l.ready) { return null; }
    var u = BASE + c + '/차시/' + encodeURIComponent(l.id) + '.html' + slideHash(n), x;
    try { x = new URL(u, location.href); } catch (e) { return null; }
    if (x.origin !== location.origin || x.pathname.indexOf(BASE) !== 0) { return null; }
    if (P.privateRel(x.pathname, BASE) !== (c + '/차시/' + l.id + '.html').normalize('NFC')) { return null; }
    return u;
  }

  /* ── 창 이동(3.3 표 둘째~다섯째 줄, 3.5 ③④): 먼저 액자를 떼고 옮긴다(수1). 창 이동은 이 함수 하나로만 한다 ── */
  function moveTop(url) {
    if (frame) { try { frame.remove(); } catch (e) {} frame = null; }
    location.replace(url);
  }
  function denied() { moveTop(BASE + 'home.html?e=denied'); }

  /* ── 진도 판정(홈·마이페이지와 같은 기록, 같은 규칙) ── */
  function progress() { return E.localProgress(c); }
  function stateOf(l, lp) {
    if (!l.ready) { return 'off'; }
    if (!has(lp.prog, l.id) || !lp.prog[l.id]) { return 'none'; }
    return E.allDone(lp.prog[l.id].checks) ? 'done' : 'doing';
  }
  function slideOf(l, lp) { return has(lp.prog, l.id) && lp.prog[l.id] ? Math.max(1, Number(lp.prog[l.id].last) | 0) : 0; }
  function totalOf(l) {
    if (rows) {
      for (var i = 0; i < rows.length; i++) { if (rows[i].course === c && rows[i].lesson_id === l.id) { return Number(rows[i].slide_count) || 0; } }
    }
    return l === cur ? deckTotal : 0;
  }
  function stageName(l) {
    var st = Array.isArray(site.stages) ? site.stages : [];
    for (var i = 0; i < st.length; i++) { if (st[i] && st[i].key === l.stage) { return st[i].name; } }
    return '';
  }
  function firstReady() {
    for (var i = 0; i < lessons.length; i++) { if (lessons[i].ready) { return lessons[i]; } }
    return null;
  }

  /* ── 그리기(2.5). 차시목록에서 받은 글자는 모두 esc로 넣는다(조건 6) ── */
  function meter(pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return '<div class="meter" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span data-v="' + pct + '"></span></div>';
  }
  /* 막대 너비는 요소의 style로 넣는다(마크업에 style 속성을 쓰지 않음, 4장) */
  function fillMeters(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.meter > span[data-v]'), function (s) { s.style.width = s.getAttribute('data-v') + '%'; });
  }
  function icon(k) { return '<svg aria-hidden="true"><use href="#s-' + (k === 'done' ? 'done' : k === 'doing' ? 'doing' : 'none') + '"></use></svg>'; }
  function rowHtml(l, lp) {
    var k = stateOf(l, lp), sub;
    if (k === 'off') { sub = '준비 중'; }
    else if (k === 'doing') { var t = totalOf(l); sub = '보는 중' + (t > 0 ? ' · ' + slideOf(l, lp) + '/' + t + '장' : ''); }
    else { sub = STXT[k]; }
    var inner = '<span class="mk st-' + k + '">' + icon(k) + '</span><span class="lno">' + esc(l.no) + '</span>' +
      '<span class="ltx"><b>' + esc(l.title) + '</b><span class="lst">' + esc(sub) + '</span></span>';
    if (k === 'off') { return '<li><span class="lrow off" data-id="' + esc(l.id) + '">' + inner + '</span></li>'; }
    return '<li><a class="lrow" data-id="' + esc(l.id) + '" href="' + esc(learnUrl(l.id)) + '"' + (l === cur ? ' aria-current="page"' : '') + '>' + inner + '</a></li>';
  }
  /* 단계 묶음. open: 펼칠 단계 key 목록(null이면 모두) */
  function listHtml(lp, open) {
    var st = Array.isArray(site.stages) ? site.stages : [];
    var h = st.map(function (s) {
      if (!s) { return ''; }
      var ls = lessons.filter(function (l) { return l.stage === s.key; });
      if (!ls.length) { return ''; }
      var ready = ls.filter(function (l) { return l.ready; });
      var done = ready.filter(function (l) { return stateOf(l, lp) === 'done'; }).length;
      var on = !open || open.indexOf(String(s.key)) >= 0;
      return '<details class="stage" data-stage="' + esc(s.key) + '"' + (on ? ' open' : '') + '><summary>' + esc(s.name) +
        '<span class="cnt">' + esc('마침 ' + done + '/' + ready.length) + '</span></summary><ol>' + ls.map(function (l) { return rowHtml(l, lp); }).join('') + '</ol></details>';
    }).join('');
    var rest = lessons.filter(function (l) { return !st.some(function (s) { return s && s.key === l.stage; }); });
    if (rest.length) { h += '<ol class="stage-rest">' + rest.map(function (l) { return rowHtml(l, lp); }).join('') + '</ol>'; }
    return h;
  }
  /* 바로 가기: ready이고 href가 서식/<파일> 꼴인 것만, 새 탭. 끝에 실습자료 받기(홈) */
  function linksHtml() {
    var ls = (Array.isArray(site.links) ? site.links : []).filter(function (x) {
      return x && x.ready === true && typeof x.href === 'string' && /^서식\/[^\/\\?#:%]+$/.test(x.href) && !/^서식\/\.\.?$/.test(x.href);
    });
    return '<h3>바로 가기</h3><ul>' + ls.map(function (x) {
      return '<li><a href="' + esc(BASE + c + '/' + x.href.split('/').map(encodeURIComponent).join('/')) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a></li>';
    }).join('') + '<li><a href="' + BASE + 'home.html">실습자료 받기</a></li></ul>';
  }
  function courseHead(lp) {
    var st = E.courseStats(site, lp.prog, lp.last), label = E.C.courseLabels[c];
    return '<p class="kicker">' + esc(label) + '</p><h2>' + esc(site.course) + '</h2>' + meter(st.pct, label + ' 진도') +
      '<p class="cprog prog">마침 ' + st.n + '/' + st.m + '차시 · ' + st.pct + '%</p>';
  }
  function stageKeyOf(l) { return l ? String(l.stage) : null; }
  function readOpen() {
    var ds = el('curr').querySelectorAll('details.stage'), out = [];
    Array.prototype.forEach.call(ds, function (d) { if (d.open) { out.push(d.getAttribute('data-stage')); } });
    return out;
  }
  function drawSide(lp) {
    var open = openStages || [];
    if (cur && open.indexOf(stageKeyOf(cur)) < 0) { open = open.concat([stageKeyOf(cur)]); }
    el('sideHead').innerHTML = courseHead(lp);
    el('curr').innerHTML = listHtml(lp, open);
    openStages = readOpen();
    fillMeters(el('side'));
  }
  function pagerParts() {
    var i = lessons.indexOf(cur);
    return { prev: i > 0 ? lessons[i - 1] : null, next: i >= 0 && i + 1 < lessons.length ? lessons[i + 1] : null };
  }
  function drawBar() {
    var pp = pagerParts(), h = '';
    el('barCourse').textContent = E.C.courseLabels[c];
    el('barTitle').textContent = cur.no + '차시 ' + cur.title;
    if (pp.prev) {
      h += pp.prev.ready ? '<a class="btn ghost prev" href="' + esc(learnUrl(pp.prev.id)) + '"><svg class="ico" aria-hidden="true"><use href="#i-prev"></use></svg><span class="btn-label">이전 차시</span></a>'
        : '<span class="btn ghost prev is-off" aria-disabled="true"><span class="btn-label">이전 차시는 준비 중입니다</span></span>';
    }
    if (pp.next) {
      h += pp.next.ready ? '<a class="btn next" href="' + esc(learnUrl(pp.next.id)) + '"><span class="btn-label">다음 차시</span><svg class="ico" aria-hidden="true"><use href="#i-next"></use></svg></a>'
        : '<span class="btn next is-off" aria-disabled="true"><span class="btn-label">다음 차시는 준비 중입니다</span></span>';
    }
    el('barNav').innerHTML = h;
    el('barNav').hidden = !h;
    var g = '';
    if (pp.prev) {
      g += pp.prev.ready ? '<a class="prev" href="' + esc(learnUrl(pp.prev.id)) + '"><small>이전 차시</small><b>' + esc(pp.prev.no + ' ' + pp.prev.title) + '</b></a>'
        : '<span class="prev is-off" aria-disabled="true"><small>이전 차시</small><b>이전 차시는 준비 중입니다</b></span>';
    }
    if (pp.next) {
      g += pp.next.ready ? '<a class="next" href="' + esc(learnUrl(pp.next.id)) + '"><small>다음 차시</small><b>' + esc(pp.next.no + ' ' + pp.next.title) + '</b></a>'
        : '<span class="next is-off" aria-disabled="true"><small>다음 차시</small><b>다음 차시는 준비 중입니다</b></span>';
    }
    el('pager').innerHTML = g;
    el('pager').hidden = !g;
    document.title = cur.title + ' · AI 활용 교육';
  }
  function drawInfo(lp) {
    var k = stateOf(cur, lp), t = totalOf(cur), s = slideOf(cur, lp);
    el('infoKicker').textContent = stageName(cur) + ' · ' + cur.no + '차시';
    el('infoTitle').textContent = cur.title;
    el('infoGoal').textContent = cur.goal || '';
    var h = '<span class="pill' + (k === 'doing' ? ' info' : k === 'done' ? ' ok' : '') + '" id="infoState">' + esc(STXT[k] || '') + '</span>';
    if (k !== 'none' && t > 0 && s > 0) {
      h += meter(s * 100 / t, '이 차시 진행') + '<small id="infoSlides">' + esc(t + '장 가운데 ' + s + '장까지 봤습니다') + '</small>';
    }
    el('infoProg').innerHTML = h;
    fillMeters(el('infoProg'));
  }
  function drawOverview(lp) {
    var st = E.courseStats(site, lp.prog, lp.last), label = E.C.courseLabels[c], first = firstReady();
    var h = '<div class="ov-head"><p class="kicker">' + esc(label) + '</p><h1>' + esc(site.course) + '</h1>' + meter(st.pct, label + ' 진도') +
      '<p class="prog">마침 ' + st.n + '/' + st.m + '차시 · ' + st.pct + '%</p><div class="row-btns">';
    if (st.resume) {
      h += '<a class="btn resume" href="' + esc(learnUrl(st.resume.lesson.id) + slideHash(st.resume.slide)) + '">' +
        esc('이어서 보기: ' + st.resume.lesson.no + ' ' + st.resume.lesson.title + ', ' + st.resume.slide + '장') + '</a>';
    } else if (first) {
      h += '<a class="btn first" href="' + esc(learnUrl(first.id)) + '">첫 차시 시작</a>';
    }
    h += '</div><p class="hint save-note">' + (rows ? TEXT.saveOk : TEXT.saveLocal) + '</p></div>' +
      '<nav class="ov-list curr" aria-label="단계별 차시">' + listHtml(lp, null) + '</nav><div class="ov-links links">' + linksHtml() + '</div>';
    el('overview').innerHTML = h;
    fillMeters(el('overview'));
  }
  function drawLesson(lp) {
    drawBar();
    drawSide(lp);
    drawInfo(lp);
  }

  /* ── 3.4 storage 알림: 지금 과정 앞말의 progress·last이거나 null(전체 지움)만 본다. 200ms 모아 한 번 그린다 ── */
  var redrawTimer = 0;
  function redraw() {
    redrawTimer = 0;
    var lp = progress();
    if (cur) {
      openStages = readOpen();
      drawSide(lp);
      drawInfo(lp);
      if (lp.last && lp.last.id === cur.id) {
        var sh = slideHash(lp.last.slide);
        if (sh) { try { history.replaceState(null, '', learnUrl(cur.id) + sh); } catch (e) {} }
      }
    } else {
      drawOverview(lp);
    }
  }
  function watchStorage() {
    var pfx = E.C.stores[c];
    window.addEventListener('storage', function (e) {
      if (!LS || e.storageArea !== LS) { return; }
      if (!(e.key === null || e.key === pfx + 'progress' || e.key === pfx + 'last')) { return; }
      if (!redrawTimer) { redrawTimer = setTimeout(redraw, 200); }
    });
  }

  /* ── 3.3 액자 안 주소 알아채기(액자 load마다) ── */
  function setFrameSrc(l, n) {   /* 액자 src로 가는 길은 이 함수 하나다(조건 7). 주소는 3.2 ③으로만 만든다 */
    var u = frameUrl(l, n);
    if (!u) { denied(); return false; }
    frame.src = u;
    return true;
  }
  function restoreFrame() {
    var lp = progress();
    setFrameSrc(cur, lp.last && lp.last.id === cur.id ? lp.last.slide : 0);
  }
  function setCurrent(l, n) {
    cur = l;
    deckTotal = 0;
    try { history.replaceState(null, '', learnUrl(l.id) + slideHash(n)); } catch (e) {}
    drawLesson(progress());
    drawFiles();
  }
  /* 3.5 ③ 액자 안이 로그인 화면: 돌아올 주소는 수강 화면. 차시는 next가 이 과정의 준비된 차시 꼴이면 그 차시, 아니면 지금 차시 */
  function frameToLogin(u) {
    var target = cur, nx = u.searchParams.get('next'), n;
    if (nx) {
      var rel = null, m, l;
      try { var x = new URL(nx, location.href); if (x.origin === location.origin) { rel = P.privateRel(x.pathname, BASE); } } catch (e) { rel = null; }
      m = rel ? LESSON_RE.exec(rel) : null;
      l = m && m[1] === c ? findLesson(m[2]) : null;
      if (l && l.ready) { target = l; }
    }
    n = slideOfHash(u.hash);
    if (!n) { var lp = progress(); if (lp.last && lp.last.id === target.id) { n = lp.last.slide; } }
    moveTop(E.loginUrl(learnUrl(target.id), slideHash(n)));
  }
  function onFrameLoad() {
    if (!frame) { return; }
    var w = frame.contentWindow, href = null, doc = null;
    try { href = w.location.href; doc = frame.contentDocument; } catch (e) { href = null; }
    if (href === 'about:blank') { return; }   /* 주소가 about:blank인 load는 매번 건너뛴다(착6) */
    var u = null, rel = null;
    try { u = new URL(href); } catch (e) { u = null; }
    if (!u || u.origin !== location.origin || u.pathname.indexOf(BASE) !== 0) { restoreFrame(); return; }
    try { rel = decodeURIComponent(u.pathname.slice(BASE.length)).normalize('NFC'); } catch (e) { restoreFrame(); return; }
    var m = LESSON_RE.exec(rel), l = m && m[1] === c ? findLesson(m[2]) : null;
    if (l && l.ready) {
      /* 수3: body의 data-page가 lesson이고 data-lesson이 그 id와 글자 그대로 같을 때만 차시 문서로 본다(읽기만) */
      var b = doc && doc.body;
      if (!b || b.getAttribute('data-page') !== 'lesson' || b.getAttribute('data-lesson') !== l.id) { return; }
      if (l !== cur) { setCurrent(l, slideOfHash(u.hash)); }
      if (!totalOf(cur)) {
        deckTotal = doc.querySelectorAll('#deck .slide').length;
        if (deckTotal) { redraw(); }
      }
      try { w.focus(); } catch (e) {}
      return;
    }
    if (rel === c + '/index.html' || rel === c + '/') { moveTop(learnUrl()); return; }
    if (rel === 'index.html') { frameToLogin(u); return; }
    if (rel === 'home.html' && u.searchParams.get('e') === 'denied') { moveTop(BASE + 'home.html?e=denied'); return; }
    moveTop(u.href);
  }
  function openFrame(n) {   /* 3.1 10번. 액자 요소를 만드는 곳은 여기 하나다(조건 7) */
    if (!frameUrl(cur, n)) { denied(); return; }
    frame = document.createElement('iframe');
    frame.id = 'frame';
    frame.title = '차시 화면';
    frame.setAttribute('allow', 'fullscreen');
    frame.addEventListener('load', onFrameLoad);
    if (!setFrameSrc(cur, n)) { frame = null; return; }
    el('stage').appendChild(frame);
  }

  /* ── 3.6 이 차시 실습자료 칸. 읽기·되돌리기·거르기는 home.js와 같은 글자(B30) ── */
  /* ── 실습자료 목록 읽기(4.13 3번). 100개씩, 10쪽까지, 쪽마다 10초. 하나라도 실패하면 전체 실패 ── */
  var PAGE = 100, MAX_PAGES = 10, LIMIT_MS = 10000;
  function readPage(c, offset) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    var late = new Promise(function (resolve, reject) {
      timer = setTimeout(function () { if (ctl) { ctl.abort(); } reject(new Error('timeout')); }, LIMIT_MS);
    });
    var req = Promise.resolve().then(function () {
      return E.sb().storage.from(E.C.bucket).list(c, { limit: PAGE, offset: offset, sortBy: { column: 'name', order: 'asc' } },
        ctl ? { signal: ctl.signal } : undefined);
    }).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data)) { throw new Error('list'); }
      return r.data;
    });
    return Promise.race([req, late]).then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; });
  }
  function readAll(c) {
    var out = [];
    function next(i) {
      if (i >= MAX_PAGES) { return Promise.reject(new Error('too-many')); }
      return readPage(c, i * PAGE).then(function (rows) {
        out = out.concat(rows);
        return rows.length < PAGE ? out : next(i + 1);
      });
    }
    return next(0);
  }

  /* ── 저장 키 되돌리기(4.13 4번, 설계서 v0.3 2.3을 거꾸로). 맞지 않으면 null ── */
  var KEY_RE = /^[0-9a-f]+\.[a-z0-9]{1,5}$/;
  function keyToRel(name) {
    if (typeof name !== 'string' || !KEY_RE.test(name)) { return null; }
    var dot = name.lastIndexOf('.'), hx = name.slice(0, dot), ext = name.slice(dot + 1);
    if (hx.length % 2) { return null; }
    var b = new Uint8Array(hx.length / 2), i;
    for (i = 0; i < b.length; i++) { b[i] = parseInt(hx.substr(i * 2, 2), 16); }
    var s;
    try { s = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return null; }
    return (s + '.' + ext).normalize('NFC');
  }
  /* 거르기(4.13 5번): 실습자료/<묶음>/<나머지>만. 빈 조각·.·..은 버리고, 다시 만든 키가 받은 키와 같은 것만 남긴다 */
  function toItem(c, name) {
    var rel = keyToRel(name);
    if (!rel) { return null; }
    var parts = rel.split('/'), i;
    if (parts.length < 3 || parts[0] !== '실습자료') { return null; }
    for (i = 0; i < parts.length; i++) { if (parts[i] === '' || parts[i] === '.' || parts[i] === '..') { return null; } }
    var k = P ? P.storageKey(c + '/' + rel) : null;
    if (!k || k.key !== c + '/' + name) { return null; }
    return { group: parts[1], path: parts.slice(2).join('/'), file: parts[parts.length - 1], rel: rel };
  }

  /* ── 그리기(3.6 4·5번): 지금 차시 묶음만. 서버에서 받은 값은 textContent·setAttribute로만 넣는다 ── */
  function setState(d, text, cls) {
    var s = d.querySelector('.files-state');
    s.textContent = text || '';
    s.className = 'files-state' + (cls ? ' ' + cls : '');
    s.hidden = !text;
  }
  function isNum(s) { return /^[0-9]+$/.test(s); }
  var files = { busy: false, done: false, items: null };
  function drawFiles() {
    var d = el('files');
    if (!d || !files.done || !cur) { return; }
    var box = d.querySelector('.files-list'), no = Number(cur.no);
    box.textContent = '';
    var mine = files.items.filter(function (it) { return isNum(it.group) && Number(it.group) === no; })
      .sort(function (a, b) { return a.path.localeCompare(b.path, 'ko'); });
    if (!mine.length) { setState(d, FILES_TEXT.none); return; }
    var ul = document.createElement('ul');
    ul.className = 'files-rows';
    mine.forEach(function (it) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = E.BASE + c + '/' + it.rel.split('/').map(encodeURIComponent).join('/');
      a.setAttribute('download', it.file);
      a.textContent = it.path;
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    setState(d, '');
  }
  /* 열 때 한 번 읽는다(B29). 처음 읽기와 toggle 처리기가 같은 busy·done을 쓴다. 실패하면 다음에 펼칠 때 다시 읽는다 */
  function readFiles() {
    var d = el('files');
    if (!d.open || files.busy || files.done) { return; }
    files.busy = true;
    d.querySelector('.files-list').textContent = '';
    setState(d, E.TEXT.loading);
    E.getSession().then(function (s) {
      if (!s) { E.toLogin(); return; }
      return readAll(c).then(function (list) {
        files.items = list.map(function (r) { return toItem(c, r && r.name); }).filter(Boolean);
        files.done = true;
        drawFiles();
      }, function () {
        d.querySelector('.files-list').textContent = '';
        setState(d, FILES_TEXT.fail, 'err');
      });
    }).then(function () { files.busy = false; }, function () {
      files.busy = false;
      d.querySelector('.files-list').textContent = '';
      setState(d, FILES_TEXT.fail, 'err');
    });
  }

  /* ── 내려받기(4.13 8번). 겉틀_덧붙임.js의 차시 내려받기(설계서 v0.3 4.10)와 같은 처리기 ── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[download]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { return; }
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || (u.protocol !== 'http:' && u.protocol !== 'https:')) { return; }
    e.preventDefault();
    fetch(u.href, { cache: 'no-store' }).then(function (r) { if (!r.ok) { throw new Error(String(r.status)); } return r.blob(); }).then(function (b) {
      var url = URL.createObjectURL(b), t = document.createElement('a');
      t.href = url; t.download = a.getAttribute('download') || ''; t.style.display = 'none';
      document.body.appendChild(t); t.click();
      setTimeout(function () { URL.revokeObjectURL(url); t.remove(); }, 1000);
    }).catch(function () { location.href = u.href; });
  }, true);

  /* ── 목록 열고 닫기(좁은 창에서는 서랍) ── */
  var mq = window.matchMedia ? window.matchMedia('(max-width:959.98px)') : null;
  function narrow() { return !!(mq && mq.matches); }
  function syncListBtn() {
    var L = el('learn');
    el('listBtn').setAttribute('aria-expanded', (narrow() ? L.classList.contains('side-open') : !L.classList.contains('side-off')) ? 'true' : 'false');
  }
  el('listBtn').addEventListener('click', function () {
    var L = el('learn');
    if (narrow()) { L.classList.toggle('side-open'); } else { L.classList.toggle('side-off'); }
    syncListBtn();
  });
  if (mq && mq.addEventListener) { mq.addEventListener('change', syncListBtn); }

  /* ── 3.1 여는 순서 ── */
  function swReady(session) { return E.registerSW().then(function () { return E.passToken(session); }); }
  function stop(text) { E.showMsg(text, 'err'); }

  E.start();
  E.screenGuard('learn').then(function (g) {
    if (!g) { return; }
    E.renderNav(g.row);
    /* 5. 과정 검증(3.2 ①) */
    if (E.COURSES.indexOf(c) < 0 || E.allowedCourses(g.row).indexOf(c) < 0) { denied(); return; }
    /* 5-1. 서비스 워커 준비(차시·개요 상태 모두) */
    return swReady(g.session).then(function () { return true; }, function () { return false; }).then(function (ok) {
      if (!ok) { stop(E.TEXT.noSw); return; }
      if (!navigator.serviceWorker.controller) {
        var path = location.pathname + location.search, gd = null;
        try { gd = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || 'null'); } catch (e) { gd = null; }
        if (!(gd && typeof gd === 'object' && gd.path === path && Date.now() - gd.at < 15000)) {
          var wrote = false;
          try { sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ path: path, at: Date.now() })); wrote = true; } catch (e) { wrote = false; }
          if (wrote) { location.reload(); return; }
        }
      }
      /* 6. 차시목록 읽기 */
      return E.loadList(c).then(function (s) {
        if (!s || !Array.isArray(s.lessons)) { stop(TEXT.listFail); el('homeLink').hidden = false; return; }
        site = s;
        lessons = s.lessons.filter(function (l) { return l && typeof l === 'object' && typeof l.id === 'string'; });
        /* 7. 차시 검증(3.2 ②). id가 없으면 개요 상태 */
        if (id !== null) {
          var l = idShapeOk(id) ? findLesson(id) : null;
          if (!l || l.ready !== true) { denied(); return; }
          cur = l;
        }
        /* 8. 진도 맞추기 한 번. 이 뒤로는 진도 항목을 쓰지 않는다 */
        return E.syncAll(g.session.user.id).then(function (r) {
          rows = r;
          var lp = progress();
          /* 9. 그리기 */
          if (!cur) {
            document.title = site.course + ' · AI 활용 교육';
            el('barTitle').textContent = site.course;
            E.showMsg('');
            drawOverview(lp);
            el('overview').hidden = false;
            watchStorage();
            return;
          }
          el('learn').classList.remove('overview');
          el('side').hidden = false;
          el('listBtn').hidden = false;
          el('sideLinks').innerHTML = linksHtml();
          drawLesson(lp);
          el('info').hidden = false;
          el('lcards').hidden = false;
          if (rows) { E.showMsg(''); } else { E.showMsg(TEXT.saveLocal, 'warn'); }
          syncListBtn();
          /* 10. 서비스 워커 준비·토큰 확인 응답 뒤 액자 */
          return swReady(g.session).then(function () {
            openFrame(slideOfHash(hash));
            /* 11. storage 처리기, 실습자료 칸 */
            watchStorage();
            el('files').addEventListener('toggle', readFiles);
            readFiles();
          }, function () { stop(E.TEXT.noSw); });
        });
      });
    });
  });
})();
