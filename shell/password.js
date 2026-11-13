/* 비밀번호 바꾸기(설계서 v0.2 3.3, 4.4) */
(function () {
  'use strict';
  var E = window.EDU, el = E.el;
  var T = {
    short: '새 비밀번호는 10자 이상이어야 합니다.',
    mix: '새 비밀번호에 영문과 숫자를 함께 써 주세요.',
    asId: '새 비밀번호가 아이디와 같습니다.',
    asCur: '새 비밀번호가 지금 비밀번호와 같습니다.',
    confirm: '새 비밀번호 두 칸이 서로 다릅니다.',
    curWrong: '지금 비밀번호가 맞지 않습니다.',
    weak: '이 비밀번호는 쓸 수 없습니다. 다른 비밀번호로 바꿔 주세요.',
    other: '비밀번호를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
  };
  var q = new URLSearchParams(location.search);
  var fromMe = q.get('from') === 'me';
  var next = E.safeNext(q.get('next'));   /* 로그인에서 장 번호(#5)까지 붙여 넘긴다 */
  var form = el('f'), err = el('err'), go = el('go');
  var row = null;

  function fieldErr(t) { err.textContent = t || ''; }
  function check(cur, n1, n2) {
    if (n1.length < 10) { return T.short; }
    if (!/[A-Za-z]/.test(n1) || !/[0-9]/.test(n1)) { return T.mix; }
    if (n1 === row.login_id) { return T.asId; }
    if (n1 === cur) { return T.asCur; }
    if (n1 !== n2) { return T.confirm; }
    return null;
  }
  function netOr(e, fallback) { return (!e.status || e.name === 'AuthRetryableFetchError') ? E.TEXT.net : fallback; }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var cur = el('cur').value, n1 = el('new1').value, n2 = el('new2').value;
    var bad = check(cur, n1, n2);
    fieldErr(bad);
    E.showMsg('');
    if (bad) { return; }
    go.disabled = true;
    var auth = E.sb().auth;
    auth.signInWithPassword({ email: row.login_id + '@' + E.C.authDomain, password: cur }).then(function (r) {
      if (r.error) { throw { step: 'cur', e: r.error }; }
      return auth.updateUser({ password: n1 });
    }).then(function (r) {
      if (r.error) { throw { step: 'update', e: r.error }; }
      return E.rpc('edu_password_changed');
    }).then(function (r) {
      if (r.error) { throw { step: 'mark', e: { status: r.status } }; }
      ['cur', 'new1', 'new2'].forEach(function (id) { el(id).value = ''; });
      var dest = next || (fromMe ? E.BASE + 'me.html' : E.BASE + 'home.html');
      E.showMsg('비밀번호를 바꿨습니다. ' + (next ? '' : (fromMe ? '마이페이지로 갑니다.' : '홈으로 갑니다.')), 'ok');
      form.hidden = true;
      setTimeout(function () { location.replace(dest); }, 1000);
    }).catch(function (x) {
      go.disabled = false;
      var e = (x && x.e) || {};
      if (x && x.step === 'cur') { E.showMsg(e.code === 'invalid_credentials' ? T.curWrong : netOr(e, T.other), 'err'); }
      else if (x && x.step === 'update') {
        if (e.code === 'weak_password') { fieldErr(T.weak); }
        else if (e.code === 'same_password') { fieldErr(T.asCur); }
        else { E.showMsg(netOr(e, T.other), 'err'); }
      } else { E.showMsg(E.TEXT.net, 'err'); }
    });
  });

  E.start();
  E.screenGuard('password', { fromMe: fromMe }).then(function (g) {
    if (!g) { return; }
    row = g.row;
    E.renderNav(row);
    E.showMsg('');
    el('intro').hidden = !row.must_change_pw;
    el('back').hidden = !(fromMe && !row.must_change_pw);
    form.hidden = false;
    el('cur').focus();
  });
})();
