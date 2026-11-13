/* 길 안내(설계서 v0.2 3.8, 4.6). 서비스 워커가 맡지 못한 상태로 내용 주소가 열리면 GitHub Pages가 이 화면을 준다.
   내용은 담지 않는다. 같은 주소는 15초 안에 한 번만 다시 연다(B12). */
(function () {
  'use strict';
  var E = window.EDU, el = E.el;
  var path = location.pathname + location.search;
  function links(login, home) {
    el('links').hidden = false;
    el('toLogin').hidden = !login;
    el('toHome').hidden = !home;
  }
  function stop(text, login, home) { E.showMsg(text, 'warn'); links(login, home); }

  if (!self.EDU_PATHS.privateRel(location.pathname, E.BASE)) { stop('없는 주소입니다.', false, true); return; }
  E.getSession().then(function (s) {
    if (!s) { location.replace(E.loginUrl(path, E.safeHash(location.hash))); return; }
    var g = null;
    try { g = JSON.parse(sessionStorage.getItem('edu.retry') || 'null'); } catch (e) { g = null; }
    if (g && g.path === path && Date.now() - g.at < 15000) { stop('내용을 열지 못했습니다. 아래 단추로 다시 로그인해 주세요.', true, true); return; }
    try { sessionStorage.setItem('edu.retry', JSON.stringify({ path: path, at: Date.now() })); } catch (e) {}
    return E.registerSW().then(function () { return E.passToken(s); }).then(function () {
      location.reload();
    }, function () { stop(E.TEXT.noSw, true, true); });
  });
})();
