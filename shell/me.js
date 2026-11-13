/* 마이페이지(설계서 v0.2 3.6, 4.7) */
(function () {
  'use strict';
  var E = window.EDU, el = E.el, esc = E.esc;

  function section(c, site, rows) {
    var label = E.C.courseLabels[c];
    if (!site) {
      return '<section class="card" data-course="' + c + '"><h2>' + esc(label) + '</h2><p class="none">이 과정의 목록을 읽지 못했습니다. 잠시 뒤 다시 열어 주세요.</p></section>';
    }
    var lp = E.localProgress(c), st = E.courseStats(site, lp.prog, lp.last);
    var byId = {};
    rows.filter(function (r) { return r.course === c; }).forEach(function (r) { byId[r.lesson_id] = r; });
    var h = '<section class="card" data-course="' + c + '"><h2>' + esc(label + ' · ' + site.course) + '</h2>';
    if (st.m > 0) { h += '<p class="prog">마침 ' + st.n + '/' + st.m + '차시 · ' + st.pct + '%</p>'; }
    if (st.resume) {
      h += '<div class="row-btns"><a class="btn ghost resume" href="' + E.BASE + c + '/차시/' + encodeURIComponent(st.resume.lesson.id) + '.html#' + st.resume.slide + '">' +
        esc('이어서 보기: ' + st.resume.lesson.no + ' ' + st.resume.lesson.title + ', ' + st.resume.slide + '장') + '</a></div>';
    } else {
      h += '<p class="none">아직 본 차시가 없습니다.</p>';
    }
    var doing = site.lessons.filter(function (l) { return l.ready && lp.prog[l.id] && !E.allDone(lp.prog[l.id].checks); });
    h += '<h3>보는 중</h3>';
    if (doing.length) {
      h += '<ul class="list doing">' + doing.map(function (l) {
        var cur = Math.max(1, Number(lp.prog[l.id].last) | 0), r = byId[l.id], tot = r ? r.slide_count : '?';   /* 장 번호는 숫자로만(하1) */
        return '<li><a href="' + E.BASE + c + '/차시/' + encodeURIComponent(l.id) + '.html#' + cur + '">' + esc(l.no + ' ' + l.title + ', ' + cur + '/' + tot + '장') + '</a></li>';
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
    el('who').textContent = '아이디: ' + g.row.login_id;
    el('acts').hidden = false;
    el('logout2').addEventListener('click', function () { E.logout(); });
    var courses = E.allowedCourses(g.row);
    return E.loadLists(courses).then(function (lists) {
      return E.syncAll(g.session.user.id).then(function (rows) {
        if (!rows) { E.showMsg(E.TEXT.net, 'err'); return; }
        E.showMsg('');
        el('courses').innerHTML = courses.map(function (c) { return section(c, lists[c], rows); }).join('');
      });
    });
  });
})();
