/* ═══════════════════════════════════════════════════════════════════════════
   COUPON GEOMETRY — 쿠폰 배경 SVG 의 «정본 생성기» (현빈 발주 2026-10-07 · 1단계)

   ══ 이 파일이 왜 «따로» 있나 ═══════════════════════════════════════════════
   ★이 파일엔 import 가 ★하나도 없다. 그래서 tests/unit 이 (.mjs 별칭 사본으로) 그대로
     싣고 잴 수 있다 — js/blocks/zoom-geometry.js 가 zoom-block.js 와 갈라져 있는 그 까닭이다.
     ⛔여기에 document·window 를 쓰지 마라. 쓰는 순간 단위 검사가 하네스를 필요로 하게 된다.

   ══ 출처 — ⛔손으로 베껴 쓴 것이 ★아니다 ═════════════════════════════════
   아래 생성기 ①②③ 은 ★시안 파일에서 ★줄째 떠 왔다(지디 발주: 「파일에서 읽어라」):
     ~/.claude/skills/지디/dashboard/artifacts/goditor-coupon-block.html  (1905줄 · 117,873자)
       :877~878  q · cl
       :888~1124 couponPath · makePieces · putNotch · scallop · paintCoupon · PAINT · paint
     ⇒ `sed -n '888,1124p'` 로 뜬 237줄 / 11,939자를 ★바꾸지 않고 붙였다.
   ★손댄 곳은 ★딱 둘이다(그 밖은 바이트 그대로):
     ⑴ 이 머리말을 앞에 붙였다.
     ⑵ 파일 끝에 `export { … }` 줄을 더했다.
   ⛔시안에 있었지만 ★안 가져온 것: hash32 · hex8 (시안의 해시 표시 전용) ·
     ★shade (시안에서도 ★부르는 데가 0 이다 — 실측 `grep -n 'shade('` = 정의 한 줄뿐).

   ══ 앱에서 어떻게 부르나 ═══════════════════════════════════════════════════
   ★시안은 540×320 «캔버스» 안에 쿠폰(cw×ch)을 ★가운데 놓고 재는 자리였다.
     앱에서는 ★블럭이 곧 쿠폰이다 ⇒ paint(st, st.cw, st.ch) 로 부른다.
     그러면 makePieces 의 x=round((CWv-w)/2)=0 · y=0 이 되어 ★쿠폰이 원점에 선다.
   ★그래서 st.canvasCol 은 ★'transparent' 다(js/blocks/coupon-block.js COUPON_DEFAULTS).
     생성기는 여전히 `<rect width=… fill=canvasCol>` 를 ★낸다 — ⛔빼지 않는다.
     빼면 시안과 ★두 벌이 된다. 투명한 사각 하나는 ★홈이 파인 자리로 뒤가 비쳐 보이게 둔다.
   ⚠️1단계는 shadow:'none' 이라 viewBox 밖으로 나가는 그림이 ★없다. 2단계에서 그림자를
     ★패널에 내면 shDx/shDy/shBlur 만큼 ★viewBox 를 넓혀야 한다(안 넓히면 조용히 잘린다).

   ══ 이 파일을 무력화하면 ═════════════════════════════════════════════════
   ★PAINT.fn 이 «그리개 꽂이»다 — 소비자(블럭 렌더 · 저장→로드 재렌더 · 패널)는 ★전부
     paint() 만 부른다. ⇒ 「그리개 한 벌인가」는 ★여기를 끊어 ★소비자 수만큼 빨강이
     나는지로 센다(tests/unit/coupon-path.test.mjs V2).
═══════════════════════════════════════════════════════════════════════════ */

function q(v){ return Math.round(v*100)/100; }
function cl(v,a,b){ return v<a?a:(v>b?b:v); }

/* ══════════════════════════════════════════════════════════
   ★정본 생성기 ① — 조각 하나를 path 글자로.
   ★시계방향으로 돌면서 ★홈은 sweep 0(안으로 파임) · ★모서리는 sweep 1(밖으로 볼록).
   rs = [좌상, 우상, 우하, 좌하]  — 조각마다 다르게 줘서 «분할»을 만든다.
   ⛔CSS 마스크 안 쓴다.
   ══════════════════════════════════════════════════════════ */
function couponPath(p){
  var x=p.x,y=p.y,w=p.w,h=p.h,nts=p.nts||[];
  var m=Math.min(w,h)/2;
  var tl=cl(p.rs[0],0,m), tr=cl(p.rs[1],0,m), br=cl(p.rs[2],0,m), bl=cl(p.rs[3],0,m);
  function pick(sd){ var a=[]; for(var i=0;i<nts.length;i++) if(nts[i].side===sd) a.push(nts[i]); return a; }
  function up(a){ return a.sort(function(u,v){return u.pos-v.pos;}); }
  function dn(a){ return a.sort(function(u,v){return v.pos-u.pos;}); }
  var d=['M'+q(x+tl)+' '+q(y)], i, s, cx, cy;
  var T=up(pick('top'));
  for(i=0;i<T.length;i++){ s=T[i]; cx=x+s.pos*w;
    d.push('L'+q(cx-s.r)+' '+q(y));
    d.push('A'+q(s.r)+' '+q(s.r)+' 0 0 0 '+q(cx+s.r)+' '+q(y)); }
  d.push('L'+q(x+w-tr)+' '+q(y));
  if(tr>0) d.push('A'+q(tr)+' '+q(tr)+' 0 0 1 '+q(x+w)+' '+q(y+tr));
  var R=up(pick('right'));
  for(i=0;i<R.length;i++){ s=R[i]; cy=y+s.pos*h;
    d.push('L'+q(x+w)+' '+q(cy-s.r));
    d.push('A'+q(s.r)+' '+q(s.r)+' 0 0 0 '+q(x+w)+' '+q(cy+s.r)); }
  d.push('L'+q(x+w)+' '+q(y+h-br));
  if(br>0) d.push('A'+q(br)+' '+q(br)+' 0 0 1 '+q(x+w-br)+' '+q(y+h));
  var B=dn(pick('bottom'));
  for(i=0;i<B.length;i++){ s=B[i]; cx=x+s.pos*w;
    d.push('L'+q(cx+s.r)+' '+q(y+h));
    d.push('A'+q(s.r)+' '+q(s.r)+' 0 0 0 '+q(cx-s.r)+' '+q(y+h)); }
  d.push('L'+q(x+bl)+' '+q(y+h));
  if(bl>0) d.push('A'+q(bl)+' '+q(bl)+' 0 0 1 '+q(x)+' '+q(y+h-bl));
  var L=dn(pick('left'));
  for(i=0;i<L.length;i++){ s=L[i]; cy=y+s.pos*h;
    d.push('L'+q(x)+' '+q(cy+s.r));
    d.push('A'+q(s.r)+' '+q(s.r)+' 0 0 0 '+q(x)+' '+q(cy-s.r)); }
  d.push('L'+q(x)+' '+q(y+tl));
  if(tl>0) d.push('A'+q(tl)+' '+q(tl)+' 0 0 1 '+q(x+tl)+' '+q(y));
  d.push('Z');
  return d.join(' ');
}

/* ★정본 생성기 ② — 설정에서 «조각들»을 뽑는다. 분할은 ★조각마다 모서리를 달리 준 것. */
function makePieces(S,CWv,CHv){
  var w=S.cw, h=S.ch, x=Math.round((CWv-w)/2), y=Math.round((CHv-h)/2), r=S.radius, P=[];
  if(S.split==='lr'){
    var sw=Math.round(w*S.stubPct/100);
    P.push({k:'stub', x:x,    y:y, w:sw,    h:h, rs:[r,0,0,r], fill:'stub'});
    P.push({k:'body', x:x+sw, y:y, w:w-sw,  h:h, rs:[0,r,r,0], fill:'body'});
  } else if(S.split==='tb'){
    var hh=Math.round(h*S.stubPct/100);
    P.push({k:'stub', x:x, y:y,    w:w, h:hh,   rs:[r,r,0,0], fill:'stub'});
    P.push({k:'body', x:x, y:y+hh, w:w, h:h-hh, rs:[0,0,r,r], fill:'body'});
  } else if(S.split==='two'){
    var g=S.gap, ha=Math.round((h-g)*S.stubPct/100), hb=h-g-ha;
    P.push({k:'body',  x:x, y:y,         w:w, h:ha, rs:[r,r,r,r], fill:'body'});
    P.push({k:'strip', x:x, y:y+ha+g,    w:w, h:hb, rs:[r,r,r,r], fill:'stub'});
  } else {
    P.push({k:'body', x:x, y:y, w:w, h:h, rs:[r,r,r,r], fill:'body'});
  }
  for(var i=0;i<P.length;i++) P[i].nts=[];
  return {P:P, box:{x:x,y:y,w:w,h:h}};
}

/* ★홈 하나를 «자기 조각»에 붙인다 — 좌표로 조각을 고른다(분할이 있어도 안 틀린다) */
function putNotch(P, box, side, pos, nr){
  var i, p, best=null, g;
  if(side==='top'||side==='bottom'){
    g=box.x+pos*box.w;
    for(i=0;i<P.length;i++){ p=P[i];
      if(g>=p.x-0.5 && g<=p.x+p.w+0.5){
        if(!best) best=p;
        else if(side==='top' ? p.y<best.y : (p.y+p.h)>(best.y+best.h)) best=p;
      } }
    if(!best) return;
    var mr=Math.min(nr, best.w/2-1, best.h-1); if(mr<=0.5) return;
    var pad=(Math.max(best.rs[0],best.rs[1],best.rs[2],best.rs[3])+mr)/best.w;
    best.nts.push({side:side, pos:cl((g-best.x)/best.w, Math.min(pad,.49), Math.max(1-pad,.51)), r:mr});
  } else {
    g=box.y+pos*box.h;
    for(i=0;i<P.length;i++){ p=P[i];
      if(g>=p.y-0.5 && g<=p.y+p.h+0.5){
        if(!best) best=p;
        else if(side==='left' ? p.x<best.x : (p.x+p.w)>(best.x+best.w)) best=p;
      } }
    if(!best) return;
    var mr2=Math.min(nr, best.h/2-1, best.w-1); if(mr2<=0.5) return;
    var pad2=(Math.max(best.rs[0],best.rs[1],best.rs[2],best.rs[3])+mr2)/best.h;
    best.nts.push({side:side, pos:cl((g-best.y)/best.h, Math.min(pad2,.49), Math.max(1-pad2,.51)), r:mr2});
  }
}

/* ★물결 테두리 별 — 안쪽 원 위에 ★바깥으로 부푼 호 N개 */
function scallop(cx,cy,R,n,amp){
  var ri=R-amp, d=[], i, a1, a2, p1, p2, pr=Math.max(1, ri*Math.sin(Math.PI/n)*1.35);
  for(i=0;i<n;i++){
    a1=(i/n)*Math.PI*2 - Math.PI/2; a2=((i+1)/n)*Math.PI*2 - Math.PI/2;
    p1=[cx+ri*Math.cos(a1), cy+ri*Math.sin(a1)];
    p2=[cx+ri*Math.cos(a2), cy+ri*Math.sin(a2)];
    if(i===0) d.push('M'+q(p1[0])+' '+q(p1[1]));
    d.push('A'+q(pr)+' '+q(pr)+' 0 0 1 '+q(p2[0])+' '+q(p2[1]));
  }
  d.push('Z'); return d.join(' ');
}

/* ══════════════════════════════════════════════════════════
   ★정본 생성기 ③ — ★★«그리는 부분» 한 벌. 입력 = ★설정값 하나 ＋ 바탕 크기.
   출력 = ★SVG 배경 글자 ＋ ★글자를 얹을 자리(사각형들).
   ★이 한 함수를 ★블록도 · ★그리드 칸의 줄도 · ★이 시안의 미리보기 넷도 ★전부 부른다.
   ⛔부르는 쪽(패널·미리보기)에 그리기를 ★흩뿌리지 마라 — 흩뿌리면 ★두 벌이 된다.
   ⛔<text> 안 넣는다(안쪽은 보통 DOM 이어야 «그릇»이 된다).
   ══════════════════════════════════════════════════════════ */
function paintCoupon(S0,CWv,CHv){
  /* ★배경 갈래 — 「쿠폰 모양」이 아니면 ★홈·절취선·분할을 ★안 쓴다(그냥 둥근 프레임). */
  var S=S0, kk;
  if(S0.bgKind!=='coupon'){
    S={}; for(kk in S0) S[kk]=S0[kk];
    S.nSides={top:false,right:false,bottom:false,left:false};
    S.perfOn=false; S.split='none';
  }
  var g=makePieces(S,CWv,CHv), P=g.P, box=g.box, i;
  var sides=['top','right','bottom','left'];
  for(i=0;i<sides.length;i++) if(S.nSides[sides[i]]) putNotch(P,box,sides[i],S.nPos/100,S.nR);

  /* 절취선 — 닿는 조각을 좌표로 고르고, 양끝 홈을 그 조각에 붙인다 */
  var perf=null;
  if(S.perfOn){
    var tgt=null, pz, k;
    if(S.perfDir==='v'){ pz=box.x+box.w*S.perfPos/100;
      for(k=0;k<P.length;k++) if(!tgt && pz>=P[k].x-0.5 && pz<=P[k].x+P[k].w+0.5) tgt=P[k];
    } else { pz=box.y+box.h*S.perfPos/100;
      for(k=0;k<P.length;k++) if(!tgt && pz>=P[k].y-0.5 && pz<=P[k].y+P[k].h+0.5) tgt=P[k]; }
    if(!tgt) tgt=P[0];
    var maxR=Math.max(tgt.rs[0],tgt.rs[1],tgt.rs[2],tgt.rs[3]);
    var inset=S.perfEnd? Math.min(S.nR, (S.perfDir==='v'?tgt.h:tgt.w)/2-1) : 7;
    if(inset<1) inset=1;
    if(S.perfDir==='v'){
      var lo=tgt.x+maxR+inset+1, hi=tgt.x+tgt.w-maxR-inset-1;
      pz=(lo<=hi)? cl(pz,lo,hi) : tgt.x+tgt.w/2;
      perf={x1:pz,y1:tgt.y+inset,x2:pz,y2:tgt.y+tgt.h-inset};
      if(S.perfEnd){
        var lp=(pz-tgt.x)/tgt.w, mr=Math.min(inset, tgt.w/2-1);
        tgt.nts.push({side:'top',pos:lp,r:mr}); tgt.nts.push({side:'bottom',pos:lp,r:mr});
      }
    } else {
      var lo2=tgt.y+maxR+inset+1, hi2=tgt.y+tgt.h-maxR-inset-1;
      pz=(lo2<=hi2)? cl(pz,lo2,hi2) : tgt.y+tgt.h/2;
      perf={x1:tgt.x+inset,y1:pz,x2:tgt.x+tgt.w-inset,y2:pz};
      if(S.perfEnd){
        var lp2=(pz-tgt.y)/tgt.h, mr2=Math.min(inset, tgt.h/2-1);
        tgt.nts.push({side:'left',pos:lp2,r:mr2}); tgt.nts.push({side:'right',pos:lp2,r:mr2});
      }
    }
  }

  /* path 글자 */
  for(i=0;i<P.length;i++) P[i].d=couponPath(P[i]);

  var defs='', pre='', main='', post='';
  var strokeAttr = S.strokeW>0 ? ' stroke="'+S.strokeCol+'" stroke-width="'+S.strokeW+'"' : '';
  var bodyFill = S.bodyCol;
  if(S.bgKind==='grad'){
    /* ★그라데이션도 ★SVG 로 — 본체색 → 스텁색 두 스탑(⛔CSS gradient 아니다) */
    defs+='<defs><linearGradient id="fgrad" x1="0" y1="0" x2="1" y2="1">'+
      '<stop offset="0" stop-color="'+S.bodyCol+'"/><stop offset="1" stop-color="'+S.stubCol+'"/>'+
      '</linearGradient></defs>';
    bodyFill='url(#fgrad)';
  }
  function paths(fillOverride, off){
    var s='', t;
    for(var j=0;j<P.length;j++){
      t=off? ' transform="translate('+q(off[0])+' '+q(off[1])+')"' : '';
      s+='<path d="'+P[j].d+'" fill="'+(fillOverride||(P[j].fill==='stub'?S.stubCol:bodyFill))+'"'+
         (fillOverride?'':strokeAttr)+t+'/>';
    }
    return s;
  }

  if(S.shadow==='layer'){
    pre=paths(S.shCol, [S.shDx,S.shDy]);
    if(S.shOpa<100) pre='<g opacity="'+(S.shOpa/100)+'">'+pre+'</g>';
  }
  if(S.shadow==='drop'){
    /* ★SVG 필터만 쓴다 — feGaussianBlur ＋ feOffset ＋ feFlood ＋ feComposite ＋ feMerge.
       ⛔CSS box-shadow·filter 아니다(html2canvas 에서 죽는다). */
    defs+='<defs><filter id="csh" filterUnits="userSpaceOnUse" x="-160" y="-160" '+
      'width="'+(CWv+320)+'" height="'+(CHv+320)+'">'+
      '<feGaussianBlur in="SourceAlpha" stdDeviation="'+q(Math.max(0.01,S.shBlur))+'" result="bl"/>'+
      '<feOffset in="bl" dx="'+q(S.shDx)+'" dy="'+q(S.shDy)+'" result="of"/>'+
      '<feFlood flood-color="'+S.shCol+'" flood-opacity="'+(S.shOpa/100)+'" result="fl"/>'+
      '<feComposite in="fl" in2="of" operator="in" result="sh"/>'+
      '<feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>'+
      '</filter></defs>';
    main='<g filter="url(#csh)">'+paths()+'</g>';
  } else {
    main=paths();
  }

  if(perf) post+='<line x1="'+q(perf.x1)+'" y1="'+q(perf.y1)+'" x2="'+q(perf.x2)+'" y2="'+q(perf.y2)+
    '" stroke="'+S.perfCol+'" stroke-width="'+S.perfW+'" stroke-linecap="round" stroke-dasharray="'+
    S.perfDash+' '+S.perfGap+'"/>';

  /* 배지 */
  var bdg=null;
  if(S.badgeOn){
    var bx = S.badgePos.charAt(1)==='r' ? box.x+box.w-10 : box.x+10;
    var by = S.badgePos.charAt(0)==='t' ? box.y+10 : box.y+box.h-10;
    bdg={x:bx,y:by,r:S.badgeR};
    post += (S.badgeShape==='star')
      ? '<path d="'+scallop(bx,by,S.badgeR,S.badgeN,S.badgeR*0.22)+'" fill="'+S.badgeCol+'"/>'
      : '<circle cx="'+q(bx)+'" cy="'+q(by)+'" r="'+q(S.badgeR)+'" fill="'+S.badgeCol+'"/>';
  }

  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+CWv+' '+CHv+'" width="'+CWv+'" height="'+CHv+'">'+
    defs+'<rect width="'+CWv+'" height="'+CHv+'" fill="'+S.canvasCol+'"/>'+pre+main+post+'</svg>';

  /* 글자 칸이 들어갈 영역 */
  function find(kk){ for(var j=0;j<P.length;j++) if(P[j].k===kk) return P[j]; return null; }
  var bodyP=find('body'), stripP=find('strip'), stubP=find('stub');
  var stubRect=null;
  if(stubP) stubRect={x:stubP.x,y:stubP.y,w:stubP.w,h:stubP.h};
  else if(S.split==='none' && perf){
    stubRect = (S.perfDir==='v')
      ? {x:perf.x1, y:box.y, w:box.x+box.w-perf.x1, h:box.h}
      : {x:box.x, y:perf.y1, w:box.w, h:box.y+box.h-perf.y1};
  }
  return {svg:svg, pieces:P, box:box, perf:perf, badge:bdg,
    bodyRect:{x:bodyP.x,y:bodyP.y,w:bodyP.w,h:bodyP.h},
    stripRect: stripP?{x:stripP.x,y:stripP.y,w:stripP.w,h:stripP.h}:null,
    stubRect: stubRect};
}

/* ★★그리개를 ★한 자리에 꽂는다 — ★소비자(미리보기 넷)는 ★전부 paint() 만 부른다.
   ⇒ 「그리개 한 벌인가」 검사는 ★여기를 끊어 ★소비자 수만큼 빨강이 나는지 센다. */
var PAINT={fn:paintCoupon};
function paint(st,w,h){ return PAINT.fn(st,w,h); }


/* ★단위 검사·블럭 렌더가 ★같은 이름으로 집는다. ⛔PAINT 를 빼지 마라 — V2 변이의 칼자리다. */
export { q, cl, couponPath, makePieces, putNotch, scallop, paintCoupon, PAINT, paint };
