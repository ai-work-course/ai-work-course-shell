/* 강사 화면(설계서 v0.2 3.7, 4.12, 6장). 임시 비밀번호는 결과 칸에만 두고 어디에도 저장하지 않는다(T3). */
(function () {
  'use strict';
  var E = window.EDU, el = E.el, esc = E.esc;
  var SIZE = 500;   /* 나눠 읽는 크기(B16). API 최대 행 수보다 작아야 한다 */
  var SHORT = { basic: '기초', advanced: '심화' };
  var ID_RE = /^[a-z0-9_-]{3,20}$/;
  var ERR = {
    bad_request: '입력한 값을 확인해 주세요.',
    invalid_login_id: '아이디는 영문 소문자·숫자·_·- 3~20자로 씁니다.',
    invalid_courses: '과정을 하나 이상 골라 주세요.',
    not_instructor: '권한이 없습니다.',
    protected_target: '교육생 계정만 바꿀 수 있습니다.',
    bad_origin: '권한이 없습니다.',
    not_found: '그 계정을 찾지 못했습니다. 새로 고침해 주세요.',
    method_not_allowed: '입력한 값을 확인해 주세요.',
    duplicate_login_id: '이미 있는 아이디입니다.',
    too_large: '입력한 값을 확인해 주세요.',
    server_error: '처리하지 못했습니다. 잠시 뒤 다시 시도하고, 새로 고침으로 지금 상태를 확인해 주세요.'
  };
  var lists = {}, roster = [];

  function pad(x) { return (x < 10 ? '0' : '') + x; }
  function when(ts) {
    if (!ts) { return '없음'; }
    var d = new Date(ts);
    if (isNaN(d.getTime())) { return '없음'; }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /* 500행씩 나눠 읽기(4.12 2번). 한 번이라도 실패하면 받은 것을 버린다 */
  function pages(make) {
    var all = [];
    function step(from) {
      return Promise.resolve(make().range(from, from + SIZE - 1)).then(function (r) {
        if (r.error) { throw new Error('page'); }
        var d = r.data || [];
        all = all.concat(d);
        return d.length < SIZE ? all : step(from + SIZE);
      });
    }
    return step(0);
  }

  function lessonOf(c, id) {
    var s = lists[c];
    if (!s) { return null; }
    for (var i = 0; i < s.lessons.length; i++) { if (s.lessons[i].id === id) { return s.lessons[i]; } }
    return null;
  }
  function progressCell(stu, rows) {
    return (stu.courses || []).filter(function (c) { return SHORT[c]; }).map(function (c) {
      var s = lists[c];
      if (!s) { return '<div>' + SHORT[c] + ' 목록 없음</div>'; }
      var ready = {}, m = 0, n = 0;
      s.lessons.forEach(function (l) { if (l.ready) { ready[l.id] = true; m++; } });
      rows.forEach(function (r) { if (r.course === c && ready[r.lesson_id] && E.allDone(r.checks)) { n++; } });
      return '<div class="cp" data-c="' + c + '">' + SHORT[c] + ' ' + n + '/' + m + ' · ' + (m ? Math.round(n * 100 / m) : 0) + '%</div>';
    }).join('');
  }
  function whereCell(rows) {
    var last = null;
    rows.forEach(function (r) { if (!last || String(r.updated_at) > String(last.updated_at)) { last = r; } });
    if (!last) { return '아직 없음'; }
    var l = lessonOf(last.course, last.lesson_id);
    return esc((SHORT[last.course] || last.course) + ' ' + (l ? l.no + '차시' : last.lesson_id) + ' ' + last.last_slide + '/' + last.slide_count + '장');
  }
  function statusOf(s) { return !s.active ? '사용 중지' : (s.must_change_pw ? '첫 로그인 전' : '사용'); }

  function render(prog) {
    var by = {};
    prog.forEach(function (r) { (by[r.user_id] = by[r.user_id] || []).push(r); });
    el('count').textContent = '교육생 ' + roster.length + '명';
    el('empty').hidden = roster.length > 0;
    el('tbl').hidden = roster.length === 0;
    el('rows').innerHTML = roster.map(function (s, i) {
      var rows = by[s.user_id] || [];
      var ops = '<button class="btn small ghost" type="button" data-op="reset" data-i="' + i + '">비밀번호 초기화</button>' +
        (s.active ? '<button class="btn small ghost" type="button" data-op="stop" data-i="' + i + '">사용 중지</button>'
                  : '<button class="btn small ghost" type="button" data-op="resume" data-i="' + i + '">다시 사용</button>') +
        '<button class="btn small ghost" type="button" data-op="courses" data-i="' + i + '">과정 바꾸기</button>';
      return '<tr data-login="' + esc(s.login_id) + '"><td>' + esc(s.login_id) + '</td><td>' +
        (s.courses || []).map(function (c) { return SHORT[c] || esc(c); }).join(', ') + '</td><td>' + statusOf(s) + '</td><td>' +
        when(s.last_seen_at) + '</td><td>' + progressCell(s, rows) + '</td><td class="where">' + whereCell(rows) + '</td><td>' + ops + '</td></tr>';
    }).join('');
    var d = new Date();
    el('stamp').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + '에 불러왔습니다';
  }

  function load() {
    E.showMsg('불러오는 중입니다.');
    el('tbl').hidden = true;
    var prog;
    return pages(function () { return E.sb().rpc('edu_roster'); }).then(function (r) {
      roster = r;
      return pages(function () {
        return E.sb().from('edu_progress').select('user_id,course,lesson_id,last_slide,slide_count,checks,updated_at')
          .order('user_id').order('course').order('lesson_id');
      });
    }).then(function (p) {
      prog = p;
      return E.loadLists(E.COURSES);
    }).then(function (l) {
      lists = l;
      E.showMsg('');
      render(prog);
    }).catch(function () {
      roster = []; lists = {};
      el('rows').innerHTML = '';
      el('tbl').hidden = true;
      el('empty').hidden = true;
      el('count').textContent = '교육생';
      el('stamp').textContent = '';
      E.showMsg(E.TEXT.net, 'err');
    });
  }

  /* edu-admin 부르기(6장). 401이면 로그인으로, 403 not_instructor면 권한 없음 */
  function callAdmin(body) {
    return E.getSession().then(function (s) {
      if (!s) { E.toLogin(); throw { handled: true }; }
      return fetch(E.C.supabaseUrl + '/functions/v1/edu-admin', {
        method: 'POST', cache: 'no-store', credentials: 'omit',
        headers: { 'Authorization': 'Bearer ' + s.access_token, 'apikey': E.C.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j || {} }; });
    }, function (e) { if (e && e.handled) { throw e; } return { status: 0, j: {} }; }).then(function (x) {
      if (x.status === 200 && x.j.ok) { return x.j; }
      if (x.status === 401) { E.toLogin(); throw { handled: true }; }
      if (x.status === 0) { throw { text: E.TEXT.net }; }
      throw { text: ERR[x.j.error] || ERR.server_error };
    });
  }
  function showResult(text, pw) {
    el('resultText').textContent = text;
    el('resultPw').textContent = pw || '';
    el('resultPw').hidden = !pw;
    el('resultWarn').hidden = !pw;
    el('result').hidden = false;
  }
  function clearResult() {
    el('resultText').textContent = '';
    el('resultPw').textContent = '';
    el('result').hidden = true;
  }
  function fail(x) { if (!x || !x.handled) { showResult((x && x.text) || ERR.server_error); load(); } }

  function chosen(a, b) { return [a, b].filter(function (x) { return el(x).checked; }).map(function (x) { return el(x).value; }); }

  function askCourses(s) {
    return new Promise(function (resolve) {
      var d = el('dlg');
      el('dlgText').textContent = s.login_id + '가 볼 과정을 고릅니다.';
      el('dBasic').checked = (s.courses || []).indexOf('basic') >= 0;
      el('dAdv').checked = (s.courses || []).indexOf('advanced') >= 0;
      d.onclose = null;
      d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(d.returnValue === 'ok' ? chosen('dBasic', 'dAdv') : null); });
      d.returnValue = '';
      d.showModal();
    });
  }

  function onOp(op, s) {
    clearResult();
    var id = s.login_id;
    if (op === 'reset') {
      if (!window.confirm(id + '의 비밀번호를 초기화할까요? 지금 비밀번호로는 더 로그인할 수 없습니다.')) { return; }
      callAdmin({ action: 'reset_password', login_id: id }).then(function (j) { showResult(id + '의 새 임시 비밀번호:', j.temp_password); load(); }, fail);
    } else if (op === 'stop') {
      if (!window.confirm(id + ' 계정의 사용을 중지할까요? 진도 기록은 남습니다.')) { return; }
      callAdmin({ action: 'set_active', login_id: id, active: false }).then(function () { showResult(id + ' 계정의 사용을 중지했습니다.'); load(); }, fail);
    } else if (op === 'resume') {
      if (!window.confirm(id + ' 계정을 다시 쓸 수 있게 할까요?')) { return; }
      callAdmin({ action: 'set_active', login_id: id, active: true }).then(function () { showResult(id + ' 계정을 다시 쓸 수 있게 했습니다.'); load(); }, fail);
    } else if (op === 'courses') {
      askCourses(s).then(function (cs) {
        if (!cs) { return; }
        if (!cs.length) { showResult(ERR.invalid_courses); return; }
        callAdmin({ action: 'set_courses', login_id: id, courses: cs }).then(function () { showResult(id + '의 과정을 바꿨습니다.'); load(); }, fail);
      });
    }
  }

  E.start();
  E.screenGuard('admin').then(function (g) {
    if (!g) { return; }
    E.renderNav(g.row);
    if (g.row.role !== 'instructor') { E.showMsg('권한이 없습니다.', 'err'); return; }
    el('area').hidden = false;
    el('reload').addEventListener('click', function () { clearResult(); load(); });
    el('resultClose').addEventListener('click', clearResult);
    el('rows').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-op]');
      if (b) { onOp(b.getAttribute('data-op'), roster[Number(b.getAttribute('data-i'))]); }
    });
    el('issue').addEventListener('submit', function (e) {
      e.preventDefault();
      clearResult();
      var id = el('newId').value.trim(), cs = chosen('cBasic', 'cAdv');
      if (!ID_RE.test(id)) { showResult(ERR.invalid_login_id); return; }
      if (!cs.length) { showResult(ERR.invalid_courses); return; }
      el('issueBtn').disabled = true;
      callAdmin({ action: 'create', login_id: id, courses: cs }).then(function (j) {
        el('newId').value = '';
        showResult(id + ' 계정을 만들었습니다. 임시 비밀번호:', j.temp_password);
        load();
      }, fail).then(function () { el('issueBtn').disabled = false; });
    });
    return load();
  });
})();
