/* 로그인 화면(설계서 v0.2 3.2, 4.3) */
(function () {
  'use strict';
  var E = window.EDU, el = E.el;
  var T = {
    empty: '아이디와 비밀번호를 넣어 주세요.',
    wrong: '아이디 또는 비밀번호가 맞지 않습니다.',
    banned: '사용이 중지된 계정입니다. 강사에게 문의해 주세요.',
    unusable: '이 계정으로는 교육 사이트를 쓸 수 없습니다. 강사에게 문의해 주세요.',
    many: '로그인 시도가 너무 많습니다. 잠시 뒤 다시 시도해 주세요.',
    other: '로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    guard: '내용을 열지 못했습니다. 다시 로그인하거나 홈으로 가 주세요.',
    busy: '로그인하는 중입니다', go: '로그인'
  };
  var ID_RE = /^[a-z0-9_-]{3,20}$/;
  var q = new URLSearchParams(location.search);
  var next = E.safeNext(q.get('next'));
  var hash = E.safeHash(location.hash);
  var form = el('f'), uid = el('uid'), pw = el('pw'), go = el('go');

  function say(t, cls) { E.showMsg(t, cls || 'err'); }
  function busy(on) { go.disabled = on; go.textContent = on ? T.busy : T.go; }
  function showGuard() {
    form.hidden = true;
    say(T.guard, 'warn');
    el('guardLinks').hidden = false;
  }

  /* 7~11번: 계정 확인, 첫 로그인, 진도 맞추기, 자동 넘김 가드, 이동 */
  function afterLogin(session) {
    return E.passToken(session).catch(function () {}).then(function () {
      return E.me();
    }).then(function (m) {
      if (!m.ok) { busy(false); say(E.TEXT.net); return; }
      var row = m.row;
      if (!row || (row.role !== 'student' && row.role !== 'instructor')) { E.logout('unusable'); return; }
      if (!row.active) { E.logout('banned'); return; }
      if (row.must_change_pw) {
        location.replace(E.BASE + 'password.html' + (next ? '?next=' + encodeURIComponent(next + hash) : ''));
        return;
      }
      return E.rpc('edu_touch').then(function () {
        return E.syncAll(session.user.id);
      }).then(function () {
        if (next) {
          var g = null;
          try { g = JSON.parse(sessionStorage.getItem('edu.autoNext') || 'null'); } catch (e) { g = null; }
          if (g && g.next === next && Date.now() - g.at < 15000) { showGuard(); return; }
          try { sessionStorage.setItem('edu.autoNext', JSON.stringify({ next: next, at: Date.now() })); } catch (e) {}
          location.replace(next + hash);
        } else {
          location.replace(E.BASE + 'home.html');
        }
      });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = uid.value.trim(), p = pw.value;
    if (!id || !p) { say(T.empty); return; }
    if (!ID_RE.test(id)) { say(T.wrong); return; }   /* 꼴이 어긋나면 요청을 보내지 않는다(L3) */
    busy(true);
    E.showMsg('');
    E.sb().auth.signInWithPassword({ email: id + '@' + E.C.authDomain, password: p }).then(function (r) {
      if (r.error) {
        busy(false);
        var c = r.error.code || '', st = r.error.status;
        if (c === 'invalid_credentials') { say(T.wrong); }
        else if (c === 'user_banned') { say(T.banned); }
        else if (st === 429 || c === 'over_request_rate_limit') { say(T.many); }
        else if (!st || r.error.name === 'AuthRetryableFetchError') { say(E.TEXT.net); }
        else { say(T.other); }
        return;
      }
      pw.value = '';
      return afterLogin(r.data.session);
    }, function () { busy(false); say(E.TEXT.net); });
  });

  E.start({ quietSw: false });
  var m = q.get('m');
  if (m === 'banned') { say(T.banned); } else if (m === 'unusable') { say(T.unusable); }
  E.getSession().then(function (s) {
    if (s) { busy(true); return afterLogin(s); }
    if (next && !m) { say(E.TEXT.lost, 'warn'); }
    form.hidden = false;
    uid.focus();
  });
})();
