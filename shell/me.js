/* 마이페이지(설계서 v0.2 3.6, 4.7). 막대·칩과 수강 화면 링크는 디자인 개편 설계서 v0.1 2.6 */
(function () {
  'use strict';
  var E = window.EDU, el = E.el, esc = E.esc;
  var ROLE = { student: '교육생', instructor: '강사' };

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
        return '<li><a href="' + esc(learnUrl(c, l.id) + slideHash(cur)) + '">' + esc(l.no + ' ' + l.title + ', ' + cur + '/' + tot + '장') + '</a>' + bar + '</li>';
      }).join('') + '</ul>';
    } else {
      h += '<p class="none">아직 본 차시가 없습니다.</p>';
    }
    h += '<h3>마친 차시</h3>';
    if (st.done.length) {
      h += '<ul class="list done">' + st.done.map(function (l) { return '<li>' + esc(l.no + ' ' + l.title) + '</li>'; }).join('') + '</ul>';
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
    var courses = E.allowedCourses(g.row);
    return E.loadLists(courses).then(function (lists) {
      return E.syncAll(g.session.user.id).then(function (rows) {
        if (!rows) { E.showMsg(E.TEXT.net, 'err'); return; }
        E.showMsg('');
        el('courses').innerHTML = courses.map(function (c) { return section(c, lists[c], rows); }).join('');
        fillMeters(el('courses'));
      });
    });
  });
})();
