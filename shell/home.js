/* 홈(설계서 v0.2 3.4, 4.7). 과정 카드의 실습자료 받기는 설계서 v0.4 4.13 */
(function () {
  'use strict';
  var E = window.EDU, el = E.el, esc = E.esc, P = window.EDU_PATHS;
  var q = new URLSearchParams(location.search);
  if (q.get('e') === 'denied') { el('denied').hidden = false; }

  /* 실습자료 받기 펼침(4.13 1번). 글은 모두 고정 문구다. 서버에서 받은 값은 여기에 넣지 않는다 */
  var FILES_TEXT = {
    fail: '실습자료 목록을 읽지 못했습니다. 접었다가 다시 펼쳐 주세요.',
    none: '받을 실습자료가 없습니다.'
  };
  var FILES_BOX = '<details class="files"><summary>실습자료 받기</summary><div class="files-body">' +
    '<p class="hint">차시에서 "교육사이트 폴더의 실습자료"를 열라고 하면, 여기서 그 차시 묶음의 파일을 받습니다.</p>' +
    '<p class="hint">받은 파일은 다운로드 폴더에 저장됩니다. 거기서 할 일에 적힌 폴더로 옮깁니다. 할 일이 옮기지 말라고 한 파일은 다운로드 폴더에서 바로 엽니다.</p>' +
    '<p class="hint">이름에 <code>/</code>가 든 파일은 앞부분과 같은 이름의 폴더를 만들어 그 안에 둡니다.</p>' +
    '<p class="files-state" role="status" hidden></p><div class="files-list"></div></div></details>';

  function card(c, site) {
    var label = E.C.courseLabels[c];
    var h = '<li class="card" data-course="' + c + '"><h2>' + esc(label) + '</h2>';
    if (!site) {
      h += '<p class="none">이 과정의 목록을 읽지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>';
    } else {
      var lp = E.localProgress(c), st = E.courseStats(site, lp.prog, lp.last);
      h += '<p class="sub">' + esc(site.course) + '</p>';
      if (st.m > 0) { h += '<p class="prog">마침 ' + st.n + '/' + st.m + '차시 · ' + st.pct + '%</p>'; }
      if (st.resume) {
        h += '<div class="row-btns"><a class="btn ghost resume" href="' + E.BASE + c + '/차시/' + encodeURIComponent(st.resume.lesson.id) + '.html#' + st.resume.slide + '">' +
          esc('이어서 보기: ' + st.resume.lesson.no + ' ' + st.resume.lesson.title + ', ' + st.resume.slide + '장') + '</a></div>';
      } else {
        h += '<p class="none">아직 본 차시가 없습니다.</p>';
      }
    }
    h += '<div class="row-btns"><a class="btn open" href="' + E.BASE + c + '/index.html">과정 열기</a></div>';
    h += FILES_BOX + '</li>';
    return h;
  }

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

  /* ── 묶음과 정렬(4.13 6번) ── */
  function isNum(s) { return /^[0-9]+$/.test(s); }
  function groupOrder(a, b) {
    var na = isNum(a), nb = isNum(b);
    if (na && nb) { return Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0); }
    if (na !== nb) { return na ? -1 : 1; }
    return a.localeCompare(b, 'ko');
  }
  function groupTitle(site, g) {
    if (!site || !Array.isArray(site.lessons) || !isNum(g)) { return g; }
    for (var i = 0; i < site.lessons.length; i++) {
      var l = site.lessons[i];
      if (l && Number(l.no) === Number(g)) { return l.no + '차시 ' + l.title; }
    }
    return g;
  }

  /* ── 그리기(4.13 7번). 서버에서 받은 값은 textContent·setAttribute로만 넣는다 ── */
  function setState(d, text, cls) {
    var s = d.querySelector('.files-state');
    s.textContent = text || '';
    s.className = 'files-state' + (cls ? ' ' + cls : '');
    s.hidden = !text;
  }
  function render(d, c, site, items) {
    var box = d.querySelector('.files-list');
    box.textContent = '';
    if (!items.length) { setState(d, FILES_TEXT.none); return; }
    var groups = {}, names = [];
    items.forEach(function (it) {
      if (!groups[it.group]) { groups[it.group] = []; names.push(it.group); }
      groups[it.group].push(it);
    });
    names.sort(groupOrder);
    names.forEach(function (g) {
      var sec = document.createElement('section'), h = document.createElement('h3'), ul = document.createElement('ul');
      sec.className = 'files-group';
      sec.setAttribute('data-group', g);
      h.textContent = groupTitle(site, g);
      ul.className = 'files-rows';
      groups[g].sort(function (a, b) { return a.path.localeCompare(b.path, 'ko'); }).forEach(function (it) {
        var li = document.createElement('li'), a = document.createElement('a');
        a.href = E.BASE + c + '/' + it.rel.split('/').map(encodeURIComponent).join('/');
        a.setAttribute('download', it.file);
        a.textContent = it.path;
        li.appendChild(a);
        ul.appendChild(li);
      });
      sec.appendChild(h);
      sec.appendChild(ul);
      box.appendChild(sec);
    });
    setState(d, '');
  }

  /* ── 펼치기(4.13 2번). 처음 펼칠 때 읽고, 성공하면 다시 읽지 않는다. 실패하면 다음에 펼칠 때 다시 읽는다 ── */
  function watchFiles(lists) {
    var state = {};
    Array.prototype.forEach.call(el('cards').querySelectorAll('.card[data-course] details.files'), function (d) {
      var c = d.closest('.card').getAttribute('data-course');
      state[c] = { busy: false, done: false };
      d.addEventListener('toggle', function () {
        var st = state[c];
        if (!d.open || st.busy || st.done) { return; }
        st.busy = true;
        d.querySelector('.files-list').textContent = '';
        setState(d, E.TEXT.loading);
        E.getSession().then(function (s) {
          if (!s) { E.toLogin(); return; }
          return readAll(c).then(function (rows) {
            var items = rows.map(function (r) { return toItem(c, r && r.name); }).filter(Boolean);
            render(d, c, lists[c], items);
            st.done = true;
          }, function () {
            d.querySelector('.files-list').textContent = '';
            setState(d, FILES_TEXT.fail, 'err');
          });
        }).then(function () { st.busy = false; }, function () {
          st.busy = false;
          d.querySelector('.files-list').textContent = '';
          setState(d, FILES_TEXT.fail, 'err');
        });
      });
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

  E.start();
  E.screenGuard('home').then(function (g) {
    if (!g) { return; }
    E.renderNav(g.row);
    var courses = E.allowedCourses(g.row);
    return E.rpc('edu_touch').then(function () {
      return E.loadLists(courses);
    }).then(function (lists) {
      return E.syncAll(g.session.user.id).then(function (rows) {
        E.showMsg(rows ? '' : E.TEXT.net, rows ? '' : 'err');
        if (!courses.length) { el('cards').innerHTML = '<li class="card"><p class="none">열 수 있는 과정이 없습니다. 강사에게 문의해 주세요.</p></li>'; return; }
        el('cards').innerHTML = courses.map(function (c) { return card(c, lists[c]); }).join('');
        watchFiles(lists);
      });
    });
  });
})();
