/* 홈(설계서 v0.2 3.4, 4.7). 과정 카드의 실습자료 받기는 설계서 v0.4 4.13. 내 강의실 모양은 디자인 개편 설계서 v0.1 2.4 */
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

  /* ── 내 강의실 그리기(디자인 개편 설계서 v0.1 2.4). 서버·차시목록에서 받은 글자는 모두 esc로 넣는다 ── */
  var SAVE_TEXT = {
    ok: '진도는 로그인한 계정에 저장됩니다. 다른 PC에서 로그인해도 이어집니다.',
    local: '서버에서 진도를 받지 못해 이 PC에 남은 진도를 보여 줍니다.'
  };
  var MARK = '<svg aria-hidden="true"><use href="#i-mark"></use></svg>';
  /* 수강 화면 주소는 이 한 꼴로 만든다(설계서 3.5 ③ 수2). 장은 1~999의 정수일 때만 붙인다(3.2 ③ 수4·문1) */
  function learnUrl(c, id) { return E.BASE + 'learn.html?c=' + c + (id ? '&id=' + encodeURIComponent(id) : ''); }
  function slideHash(n) { n = Number(n); return (Math.floor(n) === n && n >= 1 && n <= 999) ? '#' + n : ''; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function meter(pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return '<div class="meter" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span data-v="' + pct + '"></span></div>';
  }
  /* 막대 너비는 요소의 style로 넣는다(마크업에 style 속성을 쓰지 않음, 설계서 4장) */
  function fillMeters(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.meter > span[data-v]'), function (s) { s.style.width = s.getAttribute('data-v') + '%'; });
  }
  function slideCount(rows, c, id) {
    if (!rows) { return 0; }
    for (var i = 0; i < rows.length; i++) { if (rows[i].course === c && rows[i].lesson_id === id) { return Number(rows[i].slide_count) || 0; } }
    return 0;
  }
  function firstReady(site) {
    for (var i = 0; i < site.lessons.length; i++) { if (site.lessons[i].ready) { return site.lessons[i]; } }
    return null;
  }
  /* 과정 하나의 숫자: 마침·이어서 볼 차시(courseStats)와 보는 중(마이페이지와 같은 규칙) */
  function info(c, site) {
    var lp = E.localProgress(c), st = E.courseStats(site, lp.prog, lp.last);
    st.doing = site.lessons.filter(function (l) { return l.ready && has(lp.prog, l.id) && lp.prog[l.id] && !E.allDone(lp.prog[l.id].checks); }).length;
    st.prog = lp.prog;
    return st;
  }
  /* 다음에 볼 차시: 이어서 볼 차시부터(없으면 첫 차시부터) 차시목록 순서로 준비됐고 마치지 않은 차시 셋 */
  function nextLessons(site, st) {
    var out = [], from = 0, i;
    if (st.resume) { for (i = 0; i < site.lessons.length; i++) { if (site.lessons[i] === st.resume.lesson) { from = i; break; } } }
    for (i = from; i < site.lessons.length && out.length < 3; i++) {
      var l = site.lessons[i];
      if (l.ready && !(has(st.prog, l.id) && st.prog[l.id] && E.allDone(st.prog[l.id].checks))) { out.push(l); }
    }
    return out;
  }

  function resumeHero(c, site, st, rows) {
    var r = st.resume, l = r.lesson, tot = slideCount(rows, c, l.id);
    var h = '<section class="resume-hero" data-course="' + c + '" aria-label="이어서 보기"><div>' +
      '<span class="pill accent">' + esc('이어서 보기 · ' + E.C.courseLabels[c]) + '</span>' +
      '<h2>' + esc(l.no + '차시 ' + l.title) + '</h2><p class="goal">' + esc(l.goal || '') + '</p>';
    if (tot > 0) {
      h += meter(r.slide * 100 / tot, '이 차시 진행') + '<p class="meter-text">' + esc(tot + '장 가운데 ' + r.slide + '장까지 봤습니다') + '</p>';
    }
    return h + '</div><a class="btn big resume" href="' + esc(learnUrl(c, l.id) + slideHash(r.slide)) + '">이어서 보기</a></section>';
  }

  function card(c, site, st) {
    var label = E.C.courseLabels[c];
    var h = '<li class="card" data-course="' + c + '"><div class="ccover' + (c === 'advanced' ? ' alt' : '') + '"><span class="ccover-label">' +
      esc(String(label).replace(/ 과정$/, '')) + '</span>' + MARK + '</div><div class="cbody"><span class="pill">' + esc(label) + '</span>';
    var first = null;
    if (!site) {
      h += '<p class="none">이 과정의 목록을 읽지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>';
    } else {
      h += '<h3>' + esc(site.course) + '</h3>';
      h += '<p class="cmeta">' + esc(site.lessons.length + '차시 · ' + (Array.isArray(site.stages) ? site.stages.length : 0) + '단계') + '</p>';
      h += meter(st.pct, label + ' 진도');
      if (st.m > 0) { h += '<p class="prog">마침 ' + st.n + '/' + st.m + '차시 · ' + st.pct + '%</p>'; }
      if (st.resume) {
        h += '<p class="clast">최근 본 곳: <a class="resume" href="' + esc(learnUrl(c, st.resume.lesson.id) + slideHash(st.resume.slide)) + '">' +
          esc(st.resume.lesson.no + ' ' + st.resume.lesson.title + ', ' + st.resume.slide + '장') + '</a></p>';
      } else {
        h += '<p class="none">아직 본 차시가 없습니다.</p>';
        first = firstReady(site);
      }
    }
    h += '<div class="row-btns">';
    if (first) { h += '<a class="btn first" href="' + esc(learnUrl(c, first.id)) + '">첫 차시 시작</a>'; }
    h += '<a class="btn open' + (first ? ' ghost' : '') + '" href="' + esc(learnUrl(c)) + '">과정 열기</a></div>';
    h += FILES_BOX + '</div></li>';
    return h;
  }

  function sideCol(courses, lists, stats, rows) {
    var done = 0, doing = 0, parts = [], many = 0;
    courses.forEach(function (c) { if (stats[c]) { done += stats[c].n; doing += stats[c].doing; many++; } });
    var h = '<section class="panel"><h2>내 진도</h2><div class="stat"><div><b>' + done + '</b><span>마친 차시</span></div><div><b>' + doing + '</b><span>보는 중</span></div></div></section>';
    courses.forEach(function (c) {
      if (!stats[c]) { return; }
      var ls = nextLessons(lists[c], stats[c]);
      if (!ls.length) { return; }
      var r = stats[c].resume;
      parts.push((many > 1 ? '<p class="next-head">' + esc(E.C.courseLabels[c]) + '</p>' : '') + '<ol class="next-list" data-course="' + c + '">' + ls.map(function (l) {
        var u = learnUrl(c, l.id) + (r && r.lesson === l ? slideHash(r.slide) : '');
        return '<li><a href="' + esc(u) + '"><span class="no">' + esc(l.no) + '</span><span class="t">' + esc(l.title) + '</span></a></li>';
      }).join('') + '</ol>');
    });
    if (parts.length) { h += '<section class="panel"><h2>다음에 볼 차시</h2>' + parts.join('') + '</section>'; }
    h += '<section class="panel"><h2>진도 저장</h2><p class="save-note">' + (rows ? SAVE_TEXT.ok : SAVE_TEXT.local) + '</p></section>';
    return h;
  }

  function draw(g, courses, lists, rows) {
    var stats = {}, any = false;
    courses.forEach(function (c) { if (lists[c]) { stats[c] = info(c, lists[c]); if (stats[c].resume) { any = true; } } });
    var who = g.row.login_id + '님';
    el('hello').textContent = !courses.length ? who : who + (any ? ', 이어서 볼 차시가 있습니다' : ', 첫 차시부터 시작합니다');
    if (!courses.length) { el('cards').innerHTML = '<li class="card"><p class="none">열 수 있는 과정이 없습니다. 강사에게 문의해 주세요.</p></li>'; return; }
    el('resumes').innerHTML = courses.filter(function (c) { return stats[c] && stats[c].resume; }).map(function (c) { return resumeHero(c, lists[c], stats[c], rows); }).join('');
    el('cards').innerHTML = courses.map(function (c) { return card(c, lists[c], stats[c]); }).join('');
    el('sideCol').innerHTML = sideCol(courses, lists, stats, rows);
    fillMeters(document);
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
        draw(g, courses, lists, rows);
        if (courses.length) { watchFiles(lists); }
      });
    });
  });
})();
