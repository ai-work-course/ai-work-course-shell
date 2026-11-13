/* 비공개 경로 판정과 저장 키 만들기(설계서 v0.2 2.2·2.3).
   서비스 워커(importScripts), 화면(<script>), Node(require)가 같은 파일을 쓴다.
   같은 규칙이 _교육/도구/웹판/내용_올리기.py에도 있다. 둘을 함께 고친다. */
(function (root) {
  'use strict';
  var COURSES = ['basic', 'advanced'];
  var MAX_KEY = 900;

  /* 과정 앞자리 뒤 경로(NFC로 맞춘 것)가 다섯 갈래 가운데 하나인가.
     맞으면 그 경로(폴더 주소는 index.html을 붙임), 아니면 null */
  function branchOf(rel) {
    if (typeof rel !== 'string') { return null; }
    var m = rel.match(/^(basic|advanced)\/(index\.html)?$/);
    if (m) { return m[1] + '/index.html'; }
    if (/^(basic|advanced)\/(차시|실습자료|서식)\/.+/.test(rel)) { return rel; }
    if (/^(basic|advanced)\/공용\/차시목록\.js$/.test(rel)) { return rel; }
    return null;
  }

  /* 브라우저 주소의 경로(pathname)에서 비공개 경로를 뽑는다. BASE 밖이거나 풀기에 실패하거나 다섯 갈래 밖이면 null */
  function privateRel(pathname, base) {
    if (typeof pathname !== 'string' || pathname.indexOf(base) !== 0) { return null; }
    var rel;
    try { rel = decodeURIComponent(pathname.slice(base.length)).normalize('NFC'); } catch (e) { return null; }
    return branchOf(rel);
  }

  function hex(s) {
    var b, out = '', i;
    if (typeof TextEncoder !== 'undefined') { b = new TextEncoder().encode(s); }
    else { b = Buffer.from(s, 'utf8'); }
    for (i = 0; i < b.length; i++) { out += (b[i] < 16 ? '0' : '') + b[i].toString(16); }
    return out;
  }

  /* 저장 키. 결과는 {key} 또는 {error}. error 값은 내용_올리기.py와 같다:
     bad_char(#·?·\ 가 듦), outside(다섯 갈래 밖), bad_ext(확장자 규칙), too_long(900자 넘음) */
  function storageKey(rel) {
    if (typeof rel !== 'string') { return { error: 'outside' }; }
    rel = rel.normalize('NFC');
    if (/[#?\\]/.test(rel)) { return { error: 'bad_char' }; }
    var b = branchOf(rel);
    if (!b) { return { error: 'outside' }; }
    var cut = b.indexOf('/');
    var course = b.slice(0, cut), rest = b.slice(cut + 1);
    var slash = rest.lastIndexOf('/'), dot = rest.lastIndexOf('.');
    if (dot <= slash) { return { error: 'bad_ext' }; }
    var ext = rest.slice(dot + 1);
    if (!/^[A-Za-z0-9]{1,5}$/.test(ext)) { return { error: 'bad_ext' }; }
    var key = course + '/' + hex(rest.slice(0, dot)) + '.' + ext.toLowerCase();
    if (key.length > MAX_KEY) { return { error: 'too_long' }; }
    return { key: key };
  }

  /* 확장자로 응답 형식을 정한다(설계서 4.5 표) */
  var TYPES = {
    html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
    txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  function contentType(rel) {
    var dot = rel.lastIndexOf('.');
    var ext = dot >= 0 ? rel.slice(dot + 1).toLowerCase() : '';
    return Object.prototype.hasOwnProperty.call(TYPES, ext) ? TYPES[ext] : 'application/octet-stream';
  }

  var api = { COURSES: COURSES, branchOf: branchOf, privateRel: privateRel, storageKey: storageKey, contentType: contentType };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.EDU_PATHS = api;
})(typeof self !== 'undefined' ? self : this);
