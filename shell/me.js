/* 마이페이지(설계서 v0.2 3.6, 4.7). 막대·칩과 수강 화면 링크는 디자인 개편 설계서 v0.1 2.6 */
(function () {
  'use strict';
  var E = window.EDU, el = E.el, esc = E.esc;
  var ROLE = { student: '교육생', instructor: '강사' };
  var LS = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }
  /* 차시 진도 지우기(설계서 v0.6 4.2). 문구는 수강 화면(learn.js)과 같은 글자 */
  var RESET_TEXT = {
    ok: '차시 진도를 지웠습니다.',
    fail: '진도를 지우지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.',
    denied: '이 차시 진도를 지울 수 없습니다.'
  };
  var uid = null, courses = [], lists = {}, busy = false;

  /* 수강 화면 주소는 이 한 꼴로 만든다(디자인 개편 3.5 ③ 수2). 장은 1~999의 정수일 때만 붙인다(3.2 ③) */
  function learnUrl(c, id) { return E.BASE + 'learn.html?c=' + c + '&id=' + encodeURIComponent(id); }
  function slideHash(n) { n = Number(n); return (Math.floor(n) === n && n >= 1 && n <= 999) ? '#' + n : ''; }
  function meter(pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return '<div class="meter" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span data-v="' + pct + '"></span></div>';
  }
  function fillMeters(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.meter > span[data-v]'), function (s) { s.style.width = s.getAttribute('data-v') + '%'; });
  }

  /* 차시 id는 data- 속성에 esc로 넣는다(디자인 개편 6장 조건 6) */
  function resetBtn(c, l) {
    return '<button class="btn small ghost" type="button" data-act="reset" data-c="' + esc(c) + '" data-id="' + esc(l.id) + '">진도 지우기</button>';
  }

  /* 이 PC 기록 정리(설계서 v0.6 5.1 4번, B39): <앞말>progress에서 그 차시 키를 지우고(비면 항목을 지움), <앞말>last가 그 차시면 지운다. learn.js와 같은 글자 */
  function dropLocal(course, lid) {
    var pfx = E.C.stores[course];
    if (!LS || !pfx) { return; }
    try {
      var all = JSON.parse(LS.getItem(pfx + 'progress') || 'null');
      if (all && typeof all === 'object' && !Array.isArray(all) && Object.prototype.hasOwnProperty.call(all, lid)) {
        delete all[lid];
        if (Object.keys(all).length) { LS.setItem(pfx + 'progress', JSON.stringify(all)); } else { LS.removeItem(pfx + 'progress'); }
      }
    } catch (e) {}
    try {
      var last = JSON.parse(LS.getItem(pfx + 'last') || 'null');
      if (last && last.id === lid) { LS.removeItem(pfx + 'last'); }
    } catch (e) {}
  }
  function lessonOf(c, id) {
    var s = lists[c], i;
    if (!s || !Array.isArray(s.lessons)) { return null; }
    for (i = 0; i < s.lessons.length; i++) { if (s.lessons[i] && s.lessons[i].id === id) { return s.lessons[i]; } }
    return null;
  }
  /* 그리기를 다시 한다(지금 여는 순서의 뒷부분과 같은 함수). 읽지 못하면 false */
  function drawAll() {
    return E.syncAll(uid).then(function (rows) {
      if (!rows) { E.showMsg(E.TEXT.net, 'err'); return false; }
      E.showMsg('');
      el('courses').innerHTML = courses.map(function (c) { return section(c, lists[c], rows); }).join('');
      fillMeters(el('courses'));
      return true;
    });
  }
  function resetOne(c, id) {
    var l = lessonOf(c, id);
    if (busy || !l || E.COURSES.indexOf(c) < 0) { return; }
    if (!window.confirm(l.no + '차시 ' + l.title + '의 진도를 지울까요? 본 장과 체크 표시가 모두 지워지고 되돌릴 수 없습니다. 다른 창에서 이 차시를 열어 두었다면 먼저 닫아 주세요.')) { return; }
    busy = true;
    E.pendingRemove({ u: uid, c: c, id: id });   /* 남은 진도 표시에서 이 차시를 먼저 뺀다 */
    E.rpc('edu_reset_progress', { p_course: c, p_lesson_id: id }).then(function (r) {
      if (!r.error) {
        dropLocal(c, id);
        return drawAll().then(function (ok) { if (ok) { E.showMsg(l.no + RESET_TEXT.ok, 'ok'); } });
      }
      if (r.status === 401) { E.toLogin(); return; }
      E.showMsg((r.status === 403 || (r.error && r.error.code === '42501')) ? RESET_TEXT.denied : RESET_TEXT.fail, 'err');
    }).then(function () { busy = false; }, function () { busy = false; });
  }

  function section(c, site, rows) {
    var label = E.C.courseLabels[c];
    if (!site) {
      return '<section class="card" data-course="' + c + '"><h2>' + esc(label) + '</h2><p class="none">이 과정의 목록을 읽지 못했습니다. 잠시 뒤 다시 열어 주세요.</p></section>';
    }
    var lp = E.localProgress(c), st = E.courseStats(site, lp.prog, lp.last);
    var byId = {};
    rows.filter(function (r) { return r.course === c; }).forEach(function (r) { byId[r.lesson_id] = r; });
    var h = '<section class="card" data-course="' + c + '"><h2>' + esc(label + ' · ' + site.course) + '</h2>';
    h += meter(st.pct, label + ' 진도');
    if (st.m > 0) { h += '<p class="prog">마침 ' + st.n + '/' + st.m + '차시 · ' + st.pct + '%</p>'; }
    if (st.resume) {
      h += '<div class="row-btns"><a class="btn resume" href="' + esc(learnUrl(c, st.resume.lesson.id) + slideHash(st.resume.slide)) + '">' +
        esc('이어서 보기: ' + st.resume.lesson.no + ' ' + st.resume.lesson.title + ', ' + st.resume.slide + '장') + '</a></div>';
    } else {
      h += '<p class="none">아직 본 차시가 없습니다.</p>';
    }
    var doing = site.lessons.filter(function (l) { return l.ready && lp.prog[l.id] && !E.allDone(lp.prog[l.id].checks); });
    h += '<h3>보는 중</h3>';
    if (doing.length) {
      h += '<ul class="list doing">' + doing.map(function (l) {
        var cur = Math.max(1, Number(lp.prog[l.id].last) | 0), r = byId[l.id], tot = r ? r.slide_count : '?';   /* 장 번호는 숫자로만(하1) */
        var bar = (r && Number(tot) > 0) ? meter(cur * 100 / Number(tot), '이 차시 진행') : '';
        return '<li><a href="' + esc(learnUrl(c, l.id) + slideHash(cur)) + '">' + esc(l.no + ' ' + l.title + ', ' + cur + '/' + tot + '장') + '</a>' + resetBtn(c, l) + bar + '</li>';
      }).join('') + '</ul>';
    } else {
      h += '<p class="none">아직 본 차시가 없습니다.</p>';
    }
    h += '<h3>마친 차시</h3>';
    if (st.done.length) {
      h += '<ul class="list done">' + st.done.map(function (l) { return '<li>' + esc(l.no + ' ' + l.title) + resetBtn(c, l) + '</li>'; }).join('') + '</ul>';
    } else {
      h += '<p class="none">아직 마친 차시가 없습니다.</p>';
    }
    return h + '</section>';
  }

  E.start();
  E.screenGuard('me').then(function (g) {
    if (!g) { return; }
    E.renderNav(g.row);
    el('who').textContent = '아이디: ' + g.row.login_id + (ROLE[g.row.role] ? ' · ' + ROLE[g.row.role] : '');
    el('acts').hidden = false;
    el('logout2').addEventListener('click', function () { E.logout(); });
    uid = g.session.user.id;
    courses = E.allowedCourses(g.row);
    el('courses').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-act="reset"]');
      if (b) { resetOne(b.getAttribute('data-c'), b.getAttribute('data-id')); }
    });
    return E.loadLists(courses).then(function (l) {
      lists = l;
      return drawAll();
    });
  });
})();
