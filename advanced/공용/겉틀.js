/* 교육 사이트 겉틀 동작 — 첫 화면(index.html)과 차시 페이지(차시/*.html)가 함께 쓴다.
   일반 스크립트다. 모듈, import, 파일 읽어 오기를 쓰지 않는다(file 주소로 연 페이지에서 막히는 경우가 많다).
   목록 자료는 공용/차시목록.js가 window.EDU_SITE로 준다. 이 파일은 그것을 읽기만 한다.
   저장하는 것: aipc.v1.progress(차시별 체크 칸 상태와 마지막 장), aipc.v1.last(마지막으로 본 차시와 장). 이름, 계정, 작업 내용은 남기지 않는다. */
(function(){
  'use strict';
  var SITE=window.EDU_SITE||null;
  var PFX=(SITE&&SITE.store)||document.body.getAttribute('data-store')||'aipc.v1.';
  var page=document.body.getAttribute('data-page');
  var each=function(list,fn){Array.prototype.forEach.call(list,fn);};
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function pad(x){return(x<10?'0':'')+x;}

  /* ── 저장소 ─────────────────────────────────────────────
     처음에 하나 써 보고 지워 본다. 오류가 나거나 저장소가 없으면 쓸 수 없음으로 본다. */
  var ls=null,storeOK=false;
  try{
    ls=window.localStorage;
    ls.setItem(PFX+'test','1');
    ls.removeItem(PFX+'test');
    storeOK=true;
  }catch(e){storeOK=false;}
  function readJSON(name){
    if(!storeOK){return null;}
    try{var v=ls.getItem(PFX+name);return v?JSON.parse(v):null;}catch(e){return null;}
  }
  function writeJSON(name,val){
    if(!storeOK){return false;}
    try{ls.setItem(PFX+name,JSON.stringify(val));return true;}catch(e){return false;}
  }
  function getProgress(){
    var p=readJSON('progress');
    return(p&&typeof p==='object'&&!Array.isArray(p))?p:{};
  }
  function allDone(checks){
    if(!checks||!checks.length){return false;}
    for(var i=0;i<checks.length;i++){if(checks[i]!==1){return false;}}
    return true;
  }
  function statusOf(rec){
    if(!rec||typeof rec!=='object'){return'none';}
    return allDone(rec.checks)?'done':'doing';
  }
  function findLesson(id){
    if(!SITE){return null;}
    for(var i=0;i<SITE.lessons.length;i++){if(SITE.lessons[i].id===id){return SITE.lessons[i];}}
    return null;
  }

  /* ════════════════════════════════════════════════════════
     첫 화면
     ════════════════════════════════════════════════════════ */
  var STATE_TEXT={none:'안 봄',doing:'보는 중',done:'마침'};
  var SVG={
    none:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="mk-ring" cx="12" cy="12" r="9"/></svg>',
    doing:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="mk-ring" cx="12" cy="12" r="9"/><path class="mk-half" d="M12 3a9 9 0 0 1 0 18z"/></svg>',
    done:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="mk-full" cx="12" cy="12" r="10"/><path class="mk-tick" d="M7.5 12.4l3 3 6-6.4"/></svg>'
  };
  var NOTICE_OK='진도 표시는 이 PC의 브라우저에만 남습니다. 어디까지 했는지는 작업기록.md로 확인합니다.';
  var NOTICE_LOST='차시 목록을 읽지 못했습니다. '+(document.body.getAttribute('data-folder')||'교육사이트')+' 폴더를 통째로 다시 복사해 주세요.';
  var NOTICE_NO='이 브라우저에서는 진도 표시를 쓸 수 없습니다. 어디까지 했는지는 작업기록.md로 확인합니다.';
  var CONFIRM_CLEAR='진도 표시를 모두 지울까요? 작업기록.md와 실습 폴더의 파일은 지워지지 않습니다.';

  function renderIndex(){
    if(!SITE){
      /* 차시목록.js를 못 읽은 경우: 목록 없이 안내 문구만 보인다 */
      document.getElementById('notice').textContent=NOTICE_LOST;
      document.getElementById('resume').hidden=true;
      document.getElementById('clearRow').hidden=true;
      var lk0=document.getElementById('links');
      if(lk0&&lk0.parentNode){lk0.parentNode.style.display='none';}
      return;
    }
    var prog=getProgress();
    document.title=SITE.course;
    document.getElementById('course').textContent=SITE.course;
    document.getElementById('edition').textContent=SITE.edition+'판';

    /* 안내 문구 */
    document.getElementById('notice').textContent=storeOK?NOTICE_OK:NOTICE_NO;

    /* 이어서 보기 */
    var resume=document.getElementById('resume'),rbtn=document.getElementById('resumeBtn');
    var last=readJSON('last'),rl=last&&last.id?findLesson(last.id):null;
    if(storeOK&&rl&&rl.ready&&last.slide>=1){
      rbtn.textContent='이어서 보기: '+rl.no+' '+rl.title+', '+last.slide+'장';
      rbtn.setAttribute('href','차시/'+rl.id+'.html#'+last.slide);
      resume.hidden=false;
    }else{
      resume.hidden=true;
    }

    /* 단계 묶음과 차시 줄 */
    var html='';
    SITE.stages.forEach(function(st){
      var list=SITE.lessons.filter(function(l){return l.stage===st.key;});
      if(!list.length){return;}
      var doneN=0;
      var rows='';
      list.forEach(function(l){
        var s=storeOK?statusOf(prog[l.id]):'none';
        if(s==='done'){doneN++;}
        var mark='<span class="mark st-'+s+'">'+SVG[s]+'<span class="mk-txt">'+STATE_TEXT[s]+'</span></span>';
        if(!storeOK){mark='<span class="mark"></span>';}
        var body=mark+'<span class="no">'+esc(l.no)+'</span>'+
          '<span class="ttl"><b>'+esc(l.title)+'</b><span class="goal">'+esc(l.goal)+'</span></span>';
        if(l.ready){
          rows+='<li><a class="row" href="차시/'+esc(l.id)+'.html" data-id="'+esc(l.id)+'">'+body+'<span></span></a></li>';
        }else{
          rows+='<li><div class="row off" aria-disabled="true" data-id="'+esc(l.id)+'">'+body+'<span class="pill">준비 중</span></div></li>';
        }
      });
      var count=storeOK?'<span class="stage-count">마침 '+doneN+'/'+list.length+'</span>':'';
      html+='<section class="stage" data-stage="'+esc(st.key)+'"><div class="stage-head"><h2>'+esc(st.name)+'</h2>'+count+'</div><ul class="rows">'+rows+'</ul></section>';
    });
    document.getElementById('stages').innerHTML=html;

    /* 바로 가기 */
    var lk='';
    (SITE.links||[]).forEach(function(l){
      if(l.ready){lk+='<li><a href="'+esc(l.href)+'">'+esc(l.name)+'</a></li>';}
      else{lk+='<li><span class="off" aria-disabled="true">'+esc(l.name)+' · 준비 중</span></li>';}
    });
    document.getElementById('links').innerHTML=lk;

    /* 진도 지우기 */
    document.getElementById('clearRow').hidden=!storeOK;
  }

  function clearProgress(){
    if(!storeOK){return;}
    var del=[],i,k;
    for(i=0;i<ls.length;i++){k=ls.key(i);if(k&&k.indexOf(PFX)===0){del.push(k);}}
    del.forEach(function(key){try{ls.removeItem(key);}catch(e){}});
  }

  function initIndex(){
    renderIndex();
    if(!SITE){return;}
    document.getElementById('clearBtn').addEventListener('click',function(){
      if(window.confirm(CONFIRM_CLEAR)){clearProgress();renderIndex();}
    });
    /* 차시 페이지에서 뒤로 가기로 돌아오면 브라우저가 옛 화면을 보여 줄 수 있다 */
    window.addEventListener('pageshow',renderIndex);
  }

  /* ════════════════════════════════════════════════════════
     차시 페이지
     ════════════════════════════════════════════════════════ */
  function initLesson(){
    var root=document.documentElement;
    var deck=document.getElementById('deck');
    var slides=Array.prototype.slice.call(deck.querySelectorAll('.slide'));
    var n=slides.length;
    if(!n){return;}
    var lessonId=document.body.getAttribute('data-lesson');
    var cur=-1,playing=false,timer=0;
    var reduce=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
    var DUR={cover:7000,today:9000,concept:10000,request:10000,wrap:8000};

    /* ── 장마다 준비: 핵심을 어절별로 나누고, 움직임 시작 시각(--d)을 정한다 ── */
    function setD(el,t){el.style.setProperty('--d',t.toFixed(2)+'s');}
    function splitWords(el,t0,step){
      var i=0;
      (function walk(node){
        Array.prototype.slice.call(node.childNodes).forEach(function(c){
          if(c.nodeType===3){
            var f=document.createDocumentFragment();
            c.nodeValue.split(/(\s+)/).forEach(function(p){
              if(!p){return;}
              if(/^\s+$/.test(p)){f.appendChild(document.createTextNode(p));return;}
              var s=document.createElement('span');
              s.className='w';s.textContent=p;
              s.style.setProperty('--d',(t0+i*step).toFixed(2)+'s');
              i++;f.appendChild(s);
            });
            node.replaceChild(f,c);
          }else if(c.nodeType===1&&c.tagName!=='BR'){walk(c);}
        });
      })(el);
      el.classList.add('is-words');
      return i;
    }
    function prepare(slide){
      var kind=slide.getAttribute('data-kind');
      var kicker=slide.querySelector('.kicker'),say=slide.querySelector('.say');
      var t;
      if(kicker){setD(kicker,0.1);}
      if(say&&(kind==='cover'||kind==='concept'||kind==='wrap')){
        t=0.25+splitWords(say,0.25,0.09)*0.09+0.15;
      }else{
        if(say){setD(say,0.1);}
        t=0.45;
      }
      var step=(kind==='today'||kind==='practice'||kind==='check')?0.25:0.2;
      ['.col-a','.col-b'].forEach(function(sel){
        var col=slide.querySelector(sel);
        if(!col){return;}
        each(col.children,function(el){
          if(el===kicker||el===say){return;}
          if(el.matches('.items,.tasks,.checks')){
            each(el.children,function(li){setD(li,t);t+=step;});
          }else if(el.matches('.req')){
            setD(el,t);t+=1.6;
          }else{
            setD(el,t);t+=0.35;
          }
        });
      });
      var en=slide.querySelector('.end-nav');
      if(en){setD(en,t);}
    }
    slides.forEach(function(s){
      s.setAttribute('aria-hidden','true');
      s.setAttribute('aria-roledescription','슬라이드');
      prepare(s);
    });

    /* ── 진도 ── */
    var inputs=Array.prototype.slice.call(deck.querySelectorAll('.checks input[type="checkbox"]'));
    var memProg={};
    function zeros(k){var a=[],i;for(i=0;i<k;i++){a.push(0);}return a;}
    var rec=(function(){
      var all=getProgress(),r=all[lessonId];
      if(!r||typeof r!=='object'){r={checks:zeros(inputs.length),last:1};}
      else{
        if(!(r.checks instanceof Array)||r.checks.length!==inputs.length){r.checks=zeros(inputs.length);}
        if(typeof r.last!=='number'){r.last=1;}
      }
      return r;
    })();
    function saveRec(){
      memProg[lessonId]=rec;
      if(!storeOK){return;}
      var all=getProgress();
      all[lessonId]=rec;
      writeJSON('progress',all);
    }
    saveRec();

    /* ── HUD, 보충 칸, 안내 붙이기 ── */
    var hud=document.createElement('div');
    hud.className='hud';
    hud.setAttribute('role','group');
    hud.setAttribute('aria-label','슬라이드 조작');
    hud.innerHTML=
      '<div class="bar-track"><div class="bar-fill" id="bar"></div></div>'+
      '<div class="hint" id="hint">방향키, 스페이스, 클릭으로 넘깁니다 · B 보충 설명 · P 자동 재생 · F 전체 화면</div>'+
      '<div class="ctrl">'+
        '<button type="button" id="bPrev" aria-label="앞 장" title="앞 장 (왼쪽 방향키)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3.5 6 8l4.5 4.5-1 1L4 8l5.5-5.5z"/></svg></button>'+
        '<button type="button" id="bPlay" aria-label="자동 재생" aria-pressed="false" title="자동 재생 (P)"><svg class="ic-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L13 8z"/></svg><svg class="ic-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3h2.6v10H4.5zM8.9 3h2.6v10H8.9z"/></svg></button>'+
        '<button type="button" id="bNext" aria-label="다음 장" title="다음 장 (오른쪽 방향키, 스페이스)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5 10 8l-4.5 4.5 1 1L12 8 6.5 2.5z"/></svg></button>'+
        '<button type="button" id="bSupp" aria-pressed="false" title="보충 설명 (B)">보충 설명</button>'+
        '<button type="button" id="bNote" aria-pressed="false" title="발표자 메모 (N)" hidden style="display:none">메모</button>'+
        '<a class="btn" id="bList" href="../index.html" title="첫 화면의 목록">목록</a>'+
        '<span class="num" id="num" aria-live="polite">01 / '+pad(n)+'</span>'+
      '</div>';
    document.body.appendChild(hud);

    var supp=document.createElement('aside');
    supp.className='supp';
    supp.id='supp';
    supp.hidden=true;
    supp.setAttribute('aria-label','보충 설명');
    supp.innerHTML=
      '<div class="supp-head"><span id="suppTitle">보충 설명</span><button type="button" id="suppClose">닫기</button></div>'+
      '<div class="supp-body" id="suppBody" aria-live="polite"></div>';
    document.body.appendChild(supp);

    var bar=document.getElementById('bar'),num=document.getElementById('num');
    var bPlay=document.getElementById('bPlay'),bSupp=document.getElementById('bSupp');
    var bNote=document.getElementById('bNote');
    var suppTitle=document.getElementById('suppTitle'),suppBody=document.getElementById('suppBody');
    var hint=document.getElementById('hint');

    /* ── 보충 설명 ── */
    var suppOpen=false;
    function suppText(i){
      var el=slides[i].querySelector('.supp-src');
      return el?el.textContent.replace(/\s+/g,' ').trim():'';
    }
    function renderSupp(){
      if(!suppOpen){return;}
      var t=suppText(cur);
      suppTitle.textContent='보충 설명 · '+(cur+1)+'장';
      suppBody.innerHTML=t?'<p>'+esc(t)+'</p>':'<p class="none">이 장에는 보충 설명이 없습니다.</p>';
      suppBody.scrollTop=0;
    }
    function setSupp(open){
      suppOpen=open;
      supp.hidden=!open;
      root.classList.toggle('supp-open',open);
      bSupp.setAttribute('aria-pressed',open?'true':'false');
      renderSupp();
    }

    /* ── 자동 재생 ── */
    function durOf(i){return DUR[slides[i].getAttribute('data-kind')]||8000;}
    function stopKind(i){var k=slides[i].getAttribute('data-kind');return k==='practice'||k==='check';}
    function setBar(){
      var to=(cur+1)/n;
      if(playing){
        bar.style.transition='none';bar.style.transform='scaleX('+(cur/n)+')';
        void bar.offsetWidth;
        bar.style.transition='transform '+durOf(cur)+'ms linear';
      }else{
        bar.style.transition='transform .45s cubic-bezier(.2,.7,.2,1)';
      }
      bar.style.transform='scaleX('+to+')';
    }
    function schedule(force){
      clearTimeout(timer);
      if(!playing){return;}
      if(!force&&stopKind(cur)){stopPlay();return;}
      timer=setTimeout(function(){if(cur<n-1){go(cur+1);}else{stopPlay();}},stopKind(cur)?10000:durOf(cur));
    }
    function startPlay(){
      playing=true;
      root.classList.add('is-playing');
      bPlay.setAttribute('aria-pressed','true');
      if(cur===n-1){go(0);return;}
      setBar();schedule(true);
    }
    function stopPlay(){
      playing=false;clearTimeout(timer);
      root.classList.remove('is-playing');
      bPlay.setAttribute('aria-pressed','false');
      setBar();
    }
    function togglePlay(){playing?stopPlay():startPlay();}

    /* ── 장 이동 ── */
    function go(i){
      i=Math.max(0,Math.min(n-1,i));
      if(i===cur){return;}
      if(cur>=0){slides[cur].classList.remove('is-active');slides[cur].setAttribute('aria-hidden','true');}
      var s=slides[i];
      void s.offsetWidth;
      s.classList.add('is-active');s.removeAttribute('aria-hidden');
      cur=i;
      num.textContent=pad(i+1)+' / '+pad(n);
      document.body.setAttribute('data-tone',s.classList.contains('tone-accent')?'accent':'');
      try{history.replaceState(null,'','#'+(i+1));}catch(e){}
      rec.last=i+1;saveRec();
      writeJSON('last',{id:lessonId,slide:i+1});
      renderSupp();
      setBar();schedule();
    }

    function toggleNotes(){
      var on=root.classList.toggle('show-notes');
      bNote.setAttribute('aria-pressed',on?'true':'false');
    }
    function full(){
      var d=document;
      if(d.fullscreenElement){if(d.exitFullscreen){d.exitFullscreen();}}
      else if(d.documentElement.requestFullscreen){d.documentElement.requestFullscreen().catch(function(){});}
    }

    /* ── 키: event.code로 받아 한글 입력 상태에서도 같은 키로 동작한다 ── */
    document.addEventListener('keydown',function(e){
      if(e.ctrlKey||e.metaKey||e.altKey){return;}
      var t=e.target;
      if(t&&t.closest&&t.closest('input,button,a,label,select,textarea')){return;}
      switch(e.code){
        case'ArrowRight':case'ArrowDown':case'PageDown':case'Space':case'Enter':case'NumpadEnter':
          e.preventDefault();go(cur+1);break;
        case'ArrowLeft':case'ArrowUp':case'PageUp':case'Backspace':
          e.preventDefault();go(cur-1);break;
        case'Home':e.preventDefault();go(0);break;
        case'End':e.preventDefault();go(n-1);break;
        case'KeyP':togglePlay();break;
        case'KeyN':toggleNotes();break;
        case'KeyF':full();break;
        case'KeyB':setSupp(!suppOpen);break;
        case'Escape':
          if(playing){stopPlay();}
          else if(suppOpen){setSupp(false);}
          break;
        default:break;
      }
    });

    /* ── 화면 누르기: 왼쪽 22%는 앞 장, 나머지는 다음 장 ── */
    deck.addEventListener('click',function(e){
      var t=e.target;
      if(t.closest&&t.closest('a,button,input,label,.note,.req,.files,.forms,.checks,.done-row,.end-nav')){return;}
      if(window.getSelection&&String(window.getSelection())){return;}
      var r=deck.getBoundingClientRect();
      if(e.clientX-r.left<r.width*0.22){go(cur-1);}else{go(cur+1);}
    });

    function btn(id,fn){
      var b=document.getElementById(id);
      b.addEventListener('click',function(){fn();b.blur();});
    }
    btn('bPrev',function(){go(cur-1);});
    btn('bNext',function(){go(cur+1);});
    btn('bPlay',togglePlay);
    btn('bSupp',function(){setSupp(!suppOpen);});
    btn('bNote',toggleNotes);
    btn('suppClose',function(){setSupp(false);});

    window.addEventListener('hashchange',function(){
      var h=parseInt(location.hash.slice(1),10);
      if(h>=1&&h<=n){go(h-1);}
    });
    window.addEventListener('beforeprint',function(){if(playing){stopPlay();}});

    /* ── 체크 칸과 마침 단추 ── */
    var doneBtn=deck.querySelector('.done-btn'),doneMsg=deck.querySelector('.done-msg');
    var MSG_DONE='마쳤습니다. 첫 화면 진도에 마침으로 표시했습니다.';
    function updateMsg(){
      if(doneMsg){doneMsg.textContent=(storeOK&&allDone(rec.checks))?MSG_DONE:'';}
    }
    inputs.forEach(function(inp,k){
      inp.checked=rec.checks[k]===1;
      inp.addEventListener('change',function(){
        rec.checks[k]=inp.checked?1:0;
        saveRec();updateMsg();
      });
    });
    if(doneBtn){
      doneBtn.addEventListener('click',function(){
        inputs.forEach(function(inp,k){inp.checked=true;rec.checks[k]=1;});
        saveRec();updateMsg();doneBtn.blur();
      });
      if(!storeOK){
        var row=doneBtn.closest('.done-row'),warn=document.createElement('p');
        warn.className='done-warn';
        warn.textContent='이 브라우저에서는 진도를 저장하지 못합니다.';
        if(row&&row.parentNode){row.parentNode.insertBefore(warn,row.nextSibling);}
      }
    }
    updateMsg();

    /* ── 요청문 복사 단추 ──
       변환기가 요청문 상자(.req)마다 .req-copy 단추와 .req-copy-status(읽어 주는 칸)를 낸다. 모형 화면(.mock)에는 없다.
       복사 순서: navigator.clipboard.writeText → 안 되면 숨긴 textarea + execCommand('copy') → 그것도 안 되면 상자 글을 선택해 두고 "Ctrl+C를 누르세요"를 보인다.
       외부 요청 없음. 상자 글은 .req-text의 textContent 그대로(줄바꿈 유지)다. */
    var COPY_LABEL='복사하기',COPY_OK='복사했습니다',COPY_MANUAL='Ctrl+C를 누르세요';
    var COPY_SAY_MANUAL='자동 복사가 안 됩니다. 요청문을 선택해 두었으니 Ctrl+C를 누르세요.';
    function copyViaTextarea(text){
      var prev=document.activeElement,ok=false;
      var ta=document.createElement('textarea');
      ta.value=text;ta.setAttribute('readonly','');ta.setAttribute('aria-hidden','true');
      ta.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(ta);
      try{ta.focus();ta.select();ta.setSelectionRange(0,text.length);ok=document.execCommand('copy');}catch(e){ok=false;}
      document.body.removeChild(ta);
      if(prev&&prev.focus){try{prev.focus();}catch(e){}}
      return ok;
    }
    function selectNode(node){
      try{
        var r=document.createRange(),s=window.getSelection();
        r.selectNodeContents(node);s.removeAllRanges();s.addRange(r);
      }catch(e){}
    }
    function copyReq(b){
      var box=b.closest('.req'),pre=box&&box.querySelector('.req-text'),say=box&&box.querySelector('.req-copy-status');
      if(!pre){return;}
      var text=pre.textContent;
      function show(label,cls,speak,ms){
        b.textContent=label;b.classList.remove('is-copied','is-manual');
        if(cls){b.classList.add(cls);}
        if(say){say.textContent=speak||'';}
        clearTimeout(b._tm);
        b._tm=setTimeout(function(){
          b.textContent=COPY_LABEL;b.classList.remove('is-copied','is-manual');
          if(say){say.textContent='';}
        },ms);
      }
      function ok(){show(COPY_OK,'is-copied',COPY_OK,2500);}
      function manual(){selectNode(pre);show(COPY_MANUAL,'is-manual',COPY_SAY_MANUAL,7000);}
      function fallback(){if(copyViaTextarea(text)){ok();}else{manual();}}
      try{
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(ok,fallback);
        }else{fallback();}
      }catch(e){fallback();}
    }
    deck.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('.req-copy');
      if(b){copyReq(b);if(e.detail>0){b.blur();}}
    });

    /* ── 마지막 장의 끝 단추 ── */
    (function(){
      var nav=slides[n-1].querySelector('.end-nav');
      if(!nav||!SITE){return;}
      var idx=-1,i,next=null;
      for(i=0;i<SITE.lessons.length;i++){if(SITE.lessons[i].id===lessonId){idx=i;break;}}
      if(idx>=0){
        next=SITE.lessons[idx+1]||null;
      }
      var h='';
      if(next){
        if(next.ready){h+='<a class="btn" href="'+esc(next.id)+'.html">다음 차시로</a>';}
        else{h+='<span class="btn is-off" aria-disabled="true">다음 차시는 준비 중입니다</span>';}
      }
      h+='<a class="btn ghost" href="../index.html">목록으로</a>';
      nav.innerHTML=h;
    })();

    /* ── 시작 ── */
    var h0=parseInt(location.hash.slice(1),10);
    go(h0>=1&&h0<=n?h0-1:0);
    setTimeout(function(){hint.classList.add('off');},6000);
  }

  if(page==='index'){initIndex();}
  else if(page==='lesson'){initLesson();}
})();

/* ── 웹판 덧붙임 블록(설계서 v0.2 4.8~4.11). 웹판_만들기.py가 게시본 변환본 겉틀.js 뒤에 붙인다. 원본 줄은 고치지 않는다.
   1) 뒤로 가기 보호: 기억된 화면으로 돌아왔는데 로그인 세션 항목이 없으면 로그인으로.
   2) 내려받기: 브라우저가 download 링크 요청을 서비스 워커에 넘기지 않으므로, 같은 출처 링크를 fetch(서비스 워커 경유)로 받아 저장시킨다.
   3) 공통 파일을 불러 세션을 확인하고 토큰 갱신을 맡긴다(토큰이 바뀔 때마다 서비스 워커에 건넴).
   4) 과정 첫 화면: 진도 지우기 숨김, 안내 문구, 위 줄, 그 과정 서버 진도로 다시 그리기.
   5) 차시: localStorage 진도 쓰기를 지켜보다 묶어서 서버로 보낸다. 못 보낸 차시는 edu.pending에 남긴다. */
(function () {
  'use strict';
  var script = document.currentScript;
  var spath = '';
  try { spath = decodeURIComponent(new URL(script.src).pathname).normalize('NFC'); } catch (e) { return; }
  var mm = spath.match(/^(.*\/)(basic|advanced)\/공용\/겉틀\.js$/);
  if (!mm) { return; }
  var BASE = mm[1], COURSE = mm[2];
  var page = document.body.getAttribute('data-page');
  var LS = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }
  var AUTH_KEY = 'edu.auth';   /* shell/common.js의 AUTH_KEY(createClient storageKey)와 같은 이름 */
  function sessionKey() {
    if (!LS) { return null; }
    try { return LS.getItem(AUTH_KEY) !== null ? AUTH_KEY : null; } catch (e) { return null; }
  }
  function sessionRaw() {
    var k = sessionKey();
    if (!k) { return null; }
    try { var v = JSON.parse(LS.getItem(k)); return v && typeof v === 'object' ? (v.currentSession || v) : null; } catch (e) { return null; }
  }

  /* 1) 뒤로 가기 보호(대책 B). 다른 스크립트를 기다리지 않는다 */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !sessionKey()) { location.replace(BASE + 'index.html'); }
  });

  /* 2) 내려받기(4.10) */
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

  /* 3) 공통 파일 차례로 부르기 */
  function loadCommon(cb) {
    var list = ['shell/config.js', 'lib/supabase.js', 'shell/paths.js', 'shell/common.js'];
    (function next(i) {
      if (window.EDU) { return cb(window.EDU); }
      if (i >= list.length) { return cb(window.EDU || null); }
      var s = document.createElement('script');
      s.src = BASE + list[i];
      s.onload = function () { next(i + 1); };
      s.onerror = function () { cb(null); };
      document.head.appendChild(s);
    })(0);
  }
  function toLogin() {
    location.replace(BASE + 'index.html?next=' + encodeURIComponent(location.pathname + location.search) + (/^#\d{1,3}$/.test(location.hash) ? location.hash : ''));
  }

  /* ── 4) 과정 첫 화면(4.8) ── */
  function initIndex() {
    var storeOK = false;
    try { LS.setItem('edu.test', '1'); LS.removeItem('edu.test'); storeOK = true; } catch (e) { storeOK = false; }
    var state = storeOK ? 'ok' : 'no', who = null, E = null;
    var NOTE = {
      ok: '진도는 로그인한 계정에 저장됩니다. 다른 PC에서 로그인해도 이어집니다.',
      fail: '서버에서 진도를 받지 못해 이 PC에 남은 진도를 보여 줍니다.'
    };
    function apply() {
      var cr = document.getElementById('clearRow');
      if (cr) { cr.hidden = true; }
      var nt = document.getElementById('notice');
      if (nt && window.EDU_SITE !== undefined && state !== 'no') { nt.textContent = NOTE[state]; }
      var top = document.querySelector('header.top');
      if (!top) { return; }
      var bar = document.getElementById('eduBar');
      if (!bar) {
        bar = document.createElement('p');
        bar.className = 'meta';
        bar.id = 'eduBar';
        top.appendChild(bar);
      }
      var dot = '<span aria-hidden="true">·</span>';
      var h = (who ? '<span>' + String(who).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) + '</span>' + dot : '') +
        '<a href="' + BASE + 'home.html">홈</a>' + dot + '<a href="' + BASE + 'me.html">마이페이지</a>' + dot + '<a href="' + BASE + 'index.html" id="eduLogout">로그아웃</a>';
      if (bar.getAttribute('data-h') !== h) {
        bar.innerHTML = h;
        bar.setAttribute('data-h', h);
        document.getElementById('eduLogout').addEventListener('click', function (e) { e.preventDefault(); if (E) { E.logout(); } else { location.replace(BASE + 'index.html'); } });
      }
    }
    apply();
    window.addEventListener('pageshow', apply);   /* 원본 처리기 뒤에 걸리므로 늘 나중에 돈다 */
    loadCommon(function (EDU) {
      if (!EDU) { return; }
      E = EDU;
      E.watchToken();
      E.getSession().then(function (s) {
        if (!s) { toLogin(); return; }
        E.me().then(function (m) { if (m.ok && m.row) { who = m.row.login_id; apply(); } });
        return E.flushPending({ course: COURSE }).then(function (failed) {
          return E.readOwnProgress(s.user.id, COURSE).then(function (rows) {
            if (!rows) { if (state === 'ok') { state = 'fail'; } apply(); return; }
            E.rewriteLocal(rows, failed, [COURSE]);
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
          });
        });
      });
    });
  }

  /* ── 5) 차시(4.9) ── */
  function initLesson() {
    var SITE = window.EDU_SITE || null;
    var PFX = (SITE && SITE.store) || document.body.getAttribute('data-store') || 'aipc.v1.';
    var LESSON = document.body.getAttribute('data-lesson');
    var deck = document.getElementById('deck');
    var N = deck ? deck.querySelectorAll('.slide').length : 0;   /* 원본이 장으로 세는 것과 같은 선택자 */
    var E = null, timer = 0, first = 0, ver = 0, sending = false;
    var rawSet = Storage.prototype.setItem;
    var watch = !!(LS && LESSON && N);
    function uid() { var s = sessionRaw(); return s && s.user && s.user.id ? s.user.id : null; }
    function item() { return { u: uid(), c: COURSE, id: LESSON, n: N }; }
    function readPending() {
      var v = LS.getItem('edu.pending');
      if (!v) { return []; }
      try { var a = JSON.parse(v); if (Array.isArray(a)) { return a; } } catch (e) {}
      try { LS.removeItem('edu.pending'); } catch (e) {}
      return [];
    }
    function mark() {
      var it = item();
      if (!it.u) { return; }
      var a = readPending(), hit = false;
      a.forEach(function (x) { if (x && x.u === it.u && x.c === it.c && x.id === it.id) { x.n = it.n; hit = true; } });
      if (!hit) { a.push(it); }
      rawSet.call(LS, 'edu.pending', JSON.stringify(a));   /* 감싸기 전 원래 함수로 쓴다 */
    }
    function marked() {
      var it = item();
      return !!it.u && readPending().some(function (x) { return x && x.u === it.u && x.c === it.c && x.id === it.id; });
    }
    function rec() {
      try { var all = JSON.parse(LS.getItem(PFX + 'progress') || 'null'); return all && all[LESSON] ? all[LESSON] : null; } catch (e) { return null; }
    }
    function send() {
      timer = 0; first = 0;
      if (!E) { return; }
      if (sending) { schedule(); return; }   /* 보내는 중이면 끝난 뒤 다시 */
      var r = rec();
      if (!r) { return; }
      var v = ver, it = item();
      sending = true;
      E.saveRow(COURSE, LESSON, r, N).then(function (ok) {
        sending = false;
        if (ok && v === ver) { E.pendingRemove(it, rawSet); }
        else if (ok || v !== ver) { schedule(); }
      }, function () { sending = false; });
    }
    function schedule() {   /* B9: 마지막 변경 뒤 2초, 이어져도 첫 변경 뒤 5초 안 */
      var now = Date.now();
      if (!first) { first = now; }
      clearTimeout(timer);
      timer = setTimeout(send, Math.max(0, Math.min(2000, first + 5000 - now)));
    }
    if (watch) {
      Storage.prototype.setItem = function (k, v) {
        rawSet.apply(this, arguments);   /* 원래 쓰기를 먼저. 예외는 그대로 올라간다 */
        if (this === LS && k === PFX + 'progress') {
          try { ver++; mark(); schedule(); } catch (e) {}
        }
      };
      mark();   /* 처음 한 번: 원본이 이미 만든 이 차시 기록(G1) */
      var leave = function () {   /* 떠날 때 한 번 더(4.9 6번). 응답을 확인하지 못하므로 표시는 지우지 않는다 */
        if (!marked() || !E) { return; }
        var s = sessionRaw(), r = rec();
        if (!s || !s.access_token || !r) { return; }
        var last = Math.max(1, Math.min(N, Math.round(Number(r.last) || 1)));
        try {
          fetch(E.C.supabaseUrl + '/rest/v1/rpc/edu_save_progress', {
            method: 'POST', keepalive: true, credentials: 'omit', cache: 'no-store',
            headers: { 'Authorization': 'Bearer ' + s.access_token, 'apikey': E.C.publishableKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_course: COURSE, p_lesson_id: LESSON, p_last_slide: last, p_slide_count: N,
              p_checks: (r.checks || []).map(function (x) { return x === 1 ? 1 : 0; }) })
          }).catch(function () {});
        } catch (e) {}
      };
      window.addEventListener('pagehide', leave);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { leave(); } });
    }
    loadCommon(function (EDU) {
      if (!EDU) { return; }
      E = EDU;
      E.watchToken();
      E.getSession().then(function (s) {
        if (!s) { toLogin(); return; }
        if (!watch) { return; }
        mark();
        E.flushPending({ skip: { c: COURSE, id: LESSON }, rawSet: rawSet }).then(function () { send(); });
      });
    });
  }

  if (page === 'index') { initIndex(); }
  else if (page === 'lesson') { initLesson(); }
})();
