/* ═══════════════════════════════════
   GRID IFG ICON PICK — 인포그래픽 아이콘 더블클릭 → ★iconify 고르개 배선 (1017t1i2 · 2026-10-20)

   ★현빈 발주(원문): 「인포그래픽 블럭의 경우 특수하게 ★아이콘을 더블클릭하면 svg를 바로 교체할수 패널이
     나타났었지 않니?? 해당시안에는 있는데 … 이 방식이 좋은것 같아.」
     ＋ 「★인포그라피 블럭에서는 이미지 넣을 일이 없어.」
     ＋ ★정정 「35종은 샘플이라 그런거고 ★원래는 iconify 플러그인이 연결되어있어야되는거야」
     ＋ ★「iconify api 의 경우 혹시 ★스타일별? ★패밀리룩 별로는 볼수 없니?」 → 승인 「응 너의 제안대로 가자」
   ⇒ ★★둘 다 산다 — ★내장 35종은 ★«빠른 손잡이»(오프라인·0네트워크)로, ★참값은 ★iconify(243세트)로.
     그 문이 팝오버의 ★「더 찾기」다. ⛔명부(243세트·검색·세트필터)를 ★다시 짓지 않는다.
   ⇒ ★★«패밀리룩» = ★블럭이 ★세트와 ★스타일을 ★기억한다(`data-ifg-icon-set` · `data-ifg-icon-variant`)
     ⇒ 다음에 열 때 ★그 세트로 ★먼저 걸러 연다 ⇒ ★한 블럭 안 아이콘이 ★저절로 통일된다.

   ★★이 파일이 ★안 하는 일 — ⛔다시 짓지 마라. 전부 js/panels/iconify-panel.js 에 ★이미 있다:
     · 아이콘 명부·검색      `_doSearch(q, prefix)` → `${API}/search?query=..&limit=80&prefix=..`
     · 세트(패밀리) 필터     `COLLECTIONS`(:5~17 · ★손으로 박은 11칸 = All ＋ 10 prefix) → `#iconify-collection-filter`
     · 미리보기 ★속도제한 대책 `_fillPreviews` — 세트별 묶음 `${API}/${set}.json?icons=a,b,c`
                            (:301 실측 기록: 낱개 svg 80건 동시 ⇒ HTTP 429 `retry-after: 197`.
                             ⛔낱개 `<img>` 폴백을 지우지 마라 — 서버가 회복되면 저절로 그려진다)
     · 몸통 캐시            `_ICONIFY_BODY`(Map 'set:name' → {body,w,h} · 검색 사이에도 남는다)
     · 429/비-svg 응답 가드  `_doInsert` 의 `if (!res.ok) throw` ＋ `/^\s*<svg[\s>]/` 검사
   ⇒ 이 파일은 ★「그 모달을 열고, 돌아온 svg 를 ★그리드 칸 모델에 넣는」 ★배선만 한다.

   ★돌려받는 꼴 — `openIconifyModal(onPick, options)` 는 ★콜백이다:
     onPick({ name:'lucide:leaf', svg:'<svg…>…</svg>', size:64, iconColor:undefined })
     ⚠️`svg` 가 ★`<svg>` 가 ★아닐 수 있다 — 네트워크가 막히면 `_doInsert` 가 ★`<img src=…>` ★문자열을 준다.
       그걸 그대로 data URI 로 싸면 ★svg 가 아닌 것이 `imgSrc` 에 박힌다(칸이 깨진 그림이 된다).
       ⇒ ★아래 `ifgSvgToIconSrc` 가 ★`<svg` 로 시작하는지 보고 ★아니면 null 을 낸다(＋토스트).

   ★★「그럼 내 문은 ★두 벌인가」 — ⛔아니다. ★갈라 적는다(2026-10-20 · 소스로 재서 가렸다 · A5b 가 그 전제를 잠근다):
     ⒜ ★fetch 갈래 = ★★«지났다». `_doInsert` 가 ★`if (!res.ok) throw` ＋ ★`if (!/^\s*<svg[\s>]/i.test(body)) throw`
        를 ★이미 지나므로, ★2026-09-10 사고의 ★Cloudflare 안내 HTML(≈7KB)은 ★내게 ★안 온다.
     ⒝ ★그런데 ★그 문이 ★«만들어 내는» ★`<img src=…>` 폴백은 ★★«안 지났다» — ★그건 ★그 catch 가 ★일부러 내는 값이고
        ★svg 가 ★아니다. ⇒ ★내 문은 ★그 문의 ★«출력»을 받는 ★다음 칸이다(두 벌이 아니라 ★이어진 둘).
     ⒞ ★★즐겨찾기 갈래(`_selectedIcon.svg`)엔 ★그 검문이 ★★0건이다(`svgText = _selectedIcon.svg` 그대로).
        ★지금은 ★`options.favorites` 를 ★안 켜서 ★안 오지만, ★켜는 날엔 ★내 문이 ★★«유일한 문»이다. ⛔걷지 마라.
     ⚠️같은 틈이 ★기존 그리드 길(js/props/prop-grid.js `grdAddIconToSelectedCell` → `_grdSvgToDataUri`)에도
       ★있다 — ★그 자리는 ★안 건드렸다(범위 밖 · 보고에 적었다).
     ★`options.hideSize:true` 로 ★크기 칸을 숨긴다(E134 가 그 옵션을 그 까닭으로 열어 뒀다) —
       인포그래픽 아이콘 크기는 ★프리셋이 쥔다(iconSize 144/84) ⇒ ⛔`picked.size` 를 ★안 쓴다.
     ★`options.favorites` 는 ★안 켠다(기존 그리드 길과 같다 — 그 탭은 스티커 즐겨찾기용이다).

   ★★색 계약 — grid-infographic.js `_recolor` 가
     `/(<svg[^>]*\sstyle="[^"]*color:\s*)(#[0-9a-fA-F]{3,8})/` 로 ★뿌리 svg 의 `style="color:…"` 를 갈아낀다.
     iconify 가 주는 svg 엔 ★그 자리가 없다 ⇒ `ifgPaintSvgRoot` 가 ★박아 넣는다.
     ⛔안 박으면 「프리셋 적용」이 그 아이콘의 색을 ★조용히 못 바꾼다(자리표시만 바뀌고 고른 건 안 바뀐다).
═══════════════════════════════════ */

/* ── ★빠른 손잡이 명부 — {name, aliases(한글 별칭 · 빈칸 구분), path, fill?} ─────────────────
 *  ★★이 35종은 ★«참값»이 아니라 ★«빠른 손잡이»다. 현빈 정정:
 *    「★35종은 ★샘플이라 그런거고 ★원래는 ★iconify 플러그인이 ★연결되어있어야되는거야」
 *  ⇒ ★참값은 ★iconify(243세트)이고 ★그 문은 아래 「더 찾기」다. 이 35종이 사는 까닭은 ★둘뿐:
 *    ⑴ ★인터넷이 ★없을 때도 ★뜬다(iconify 는 ★전부 네트워크다 — `:301` 의 429 기록이 그 증거)
 *    ⑵ ★한 번 누르면 ★바로 바뀐다(모달·검색·fetch 0회)
 *  ★순서 = 시안 격자의 읽는 순서 그대로.
 *  ★`path` 는 ★lucide 선 그림 꼴(fill 없음 · stroke-width 2 · round 캡/조인) — ★그래서 기본 세트도 `lucide` 다.
 *  ⚠️`bolt` 만 ★채운 그림이라 `fill:'currentColor'` 다(시안에서도 그 하나뿐이었다).
 *  ⚠️★솔직히 — `swap-box`·`bolt`·`funnel` 은 lucide 에 ★같은 이름이 없거나 판에 따라 다르다.
 *    ★이름은 «우리 것»이고 그림은 ★lucide 꼴로 ★내가 적은 것이다. ⛔「lucide 와 글자까지 같다」는 ★안 쟀다.
 *    ⇒ ★영구 제품 데이터로 둘 것이면 ★한 번 눈으로 보는 것이 맞다(보고에 적었다). */
/* ★★261020 ★정정 비석 — ★커밋 `5b6d2f63` 의 ★메시지에 ★「내장 ★36종」이라 ★두 곳에 적혔다.
   ★★참값은 ★★35종이다. ★아래 배열과 `tests/unit/grid-ifg-icon-pick.test.mjs` 의
   `assert.equal(C.IFG_ICONS.length, 35)` 가 ★둘 다 ★35 다.
   ★왜 틀렸나(★지디): ★`name:` 을 ★★«파일 전체»에서 세어 ★36 을 얻었다 — ★배열 ★밖의 한 건이 섞였다.
     ⇒ ★★«정의 자리»(이 배열) 안으로 ★좁혀 세면 ★35. ★내 명부의
       「★맨숫자 금지 · ★«정의 자리에서 세라»」를 ★또 밟았다.
   ⛔커밋 메시지는 ★되쓰지 ★않는다(amend·force 금지 · ★이미 push 됨) ⇒ ★★소스에 ★비석으로 남긴다.
   ★이 모듈 안의 `if (_byName.size !== IFG_ICONS.length) throw` 가 ★수를 ★스스로 잠근다 —
   ★★코드는 ★안 늙었고 ★★메시지만 ★늙었다. */
export const IFG_ICONS = [
  { name: 'diamond', aliases: '다이아 칼날 코팅 보석',
    path: '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z"/>' },
  { name: 'arrow-up-down', aliases: '높이 조절 위아래 화살표',
    path: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>' },
  { name: 'fan', aliases: '모터 팬 흡입 바람개비',
    path: '<path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/>' },
  { name: 'gauge', aliases: '세기 파워 계기 속도',
    path: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>' },
  { name: 'shield-check', aliases: '안전 보호 방패 인증',
    path: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>' },
  { name: 'battery-full', aliases: '배터리 충전 용량',
    path: '<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/><line x1="14" x2="14" y1="11" y2="13"/>' },
  { name: 'monitor', aliases: '화면 디스플레이 표시 모니터',
    path: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>' },
  { name: 'trash-2', aliases: '먼지통 휴지통 비우기',
    path: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>' },
  { name: 'scaling', aliases: '크기 컴팩트 사이즈',
    path: '<path d="M21 3 9 15"/><path d="M12 3H3v18h18v-9"/><path d="M16 3h5v5"/><path d="M14 15H9v-5"/>' },
  { name: 'droplet', aliases: '물방울 수분 촉촉',
    path: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>' },
  { name: 'droplets', aliases: '물 세척 헹굼 물방울',
    path: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>' },
  { name: 'thermometer', aliases: '온도 살균 보온 고온',
    path: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>' },
  { name: 'wind', aliases: '바람 건조 열풍 공기',
    path: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>' },
  { name: 'timer', aliases: '타이머 시간 쾌속 예약',
    path: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>' },
  { name: 'volume-x', aliases: '저소음 조용 무음',
    path: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>' },
  { name: 'leaf', aliases: '친환경 절수 잎 순한',
    path: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>' },
  { name: 'layout-grid', aliases: '수납 칸 격자 넉넉',
    path: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>' },
  { name: 'sparkles', aliases: '반짝 깨끗 세척 탄력',
    path: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>' },
  { name: 'heart', aliases: '하트 건강 사랑 비타민',
    path: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' },
  { name: 'clock', aliases: '시계 시간 하루 지속',
    path: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  { name: 'check-circle', aliases: '체크 인증 완료 확인',
    path: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>' },
  { name: 'package', aliases: '상자 포장 구성 택배',
    path: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>' },
  { name: 'sun', aliases: '해 햇빛 자외선',
    path: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>' },
  { name: 'smile', aliases: '웃음 맛 만족 미소',
    path: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>' },
  { name: 'funnel', aliases: '필터 거름 깔때기',
    path: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>' },
  { name: 'moon', aliases: '달 수면 밤 취침',
    path: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' },
  { name: 'zap', aliases: '번개 절전 전기 빠른',
    path: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { name: 'snowflake', aliases: '눈 보냉 차가운 얼음',
    path: '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>' },
  { name: 'lock', aliases: '잠금 밀폐 자물쇠',
    path: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  { name: 'feather', aliases: '깃털 가벼운 저분자',
    path: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" x2="2" y1="8" y2="22"/><line x1="17.5" x2="9" y1="15" y2="15"/>' },
  { name: 'bolt', aliases: '번개 전력 충전 고속', fill: 'currentColor',
    path: '<path d="M13 2 3 14h8l-1 8 10-12h-8z"/>' },
  { name: 'rocket', aliases: '로켓 빠른 배송 내일 도착',
    path: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>' },
  { name: 'truck', aliases: '트럭 배송 무료배송 택배',
    path: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>' },
  { name: 'swap-box', aliases: '교환 반품 상자 되돌리기',
    path: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 9.5h8l-2.5-2.5"/><path d="M16 14.5H8l2.5 2.5"/>' },
  { name: 'phone-call', aliases: '전화 상담 고객센터 통화',
    path: '<path d="M13 2a9 9 0 0 1 9 9"/><path d="M13 6a5 5 0 0 1 5 5"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' },
];

const URI_HEAD = 'data:image/svg+xml;base64,';
const DEFAULT_COLOR = '#222222';
const _hexOk = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
const _b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const _unb64 = (s) => decodeURIComponent(escape(atob(s)));

/* ── 「이 줄은 아이콘 자리인가」 ────────────────────────────────────────────
 * ★★왜 이 판정이 ★있나 (⛔「표식이 있으면 전부 아이콘」으로 되돌리기 전에 읽어라)
 *   발주서의 전제는 「인포그래픽엔 사진이 들어갈 일이 없다」였다. ★코드로 재 보니 ★사진이 들어가는 길이
 *   ★실재한다 — 그 길들은 `block.dataset.ifgPreset` 을 ★안 본다:
 *     · 우클릭 「이미지 교체」      js/block-factory.js (#bcm-grid-img)
 *     · 패널 [이미지 선택…]        js/props/prop-grid.js
 *     · 스크래치패드 끌어놓기      js/canvas-scratch-drop.js (kind:'gridimg' — 칸의 아무 이미지 줄이나 집는다)
 *     · MCP/IPC updateGridBlock{patchCell:{imgSrc}}
 *   ⇒ 표식만 보고 가로채면 ★그 사진의 ★크롭 편집(2026-09-25 현빈 요구)이 ★영영 못 열리고,
 *     고르는 순간 ★사진이 아이콘으로 ★덮인다(되돌리는 길은 ⌘Z 뿐).
 * ★그래서 ★값으로 잰다 — 빈 슬롯 ∪ svg data URI ∪ ★`.svg` 로 끝나는 참조.
 * ★★⛔`data:` 만 보면 ★틀린다(2026-10-20 · 9334 산 프로젝트 실측 — 내 첫 판이 여기서 깨졌다):
 *   ★설정의 「이미지 외부화」(js/settings/settings-modal.js:480)가 ★인라인 base64 를 파일로 뽑아
 *   `goya-asset://<projectId>/<hash>.<ext>` 로 바꾼다. ★아이콘도 같이 뽑힌다 ⇒ `…/<hash>.svg`.
 *   ★실측: 현빈 proj_1791778999148 의 image 줄 ★34개 중 ★25개가 그 꼴(인포그래픽 3블럭 중 ★2블럭 전부).
 *   ⇒ `data:` 만 보던 판에선 ★그 둘에서 고르개가 ★한 번도 안 떴다. ⛔이 가지를 좁히지 마라. */
const SVG_URI_RE = /^data:image\/svg\+xml[;,]/i;
const SVG_PATH_RE = /\.svg(?:[?#][\s\S]*)?$/i;
export function ifgIsIconSrc(src) {
  if (src == null || src === '') return true;          // 빈 슬롯 = 아직 아이콘이 안 들어간 아이콘 자리
  const s = String(src).trim();
  return SVG_URI_RE.test(s) || SVG_PATH_RE.test(s);    // ★`.svg` = 외부화된 아이콘(goya-asset·assets·http 모두)
}

/** 그 아이콘 URI 에 박힌 색(`style="color:#xxxxxx"`). 못 읽으면 null — ⛔기본색으로 ★눙치지 않는다.
 *  ⚠️외부화된 참조(`goya-asset://…svg`)는 ★여기서 색을 못 읽는다(파일이다) ⇒ null. 대타는 `_presetIconColor`. */
export function ifgIconSrcColor(src) {
  const s = String(src == null ? '' : src);
  if (s.indexOf(URI_HEAD) !== 0) return null;
  let svg;
  try { svg = _unb64(s.slice(URI_HEAD.length)); } catch (_) { return null; }
  const m = /<svg[^>]*\sstyle="[^"]*color:\s*(#[0-9a-fA-F]{6})/.exec(svg);
  return m ? m[1].toLowerCase() : null;
}

/** 그 블럭 표식의 프리셋 아이콘 색 — ★색을 못 읽는 자리(외부화된 svg · 빈 슬롯)의 ★대타.
 *  ★`window.GRID_IFG_PRESETS` 를 ★«부를 때» 읽는다 — grid-infographic.js 가 ★이미 그렇게 내놓았고
 *    (prop-grid.js 가 같은 다리로 이름표를 읽는다) ⛔import 하면 ★순환 위험이자 하네스를 넓힌다.
 *  ⚠️`tiers` 는 아이콘 ★크기만 단계로 가른다 — ★색은 프리셋 최상위 한 값(실측 basic #222222 · lines #111111). */
function _presetIconColor(block) {
  try {
    const key = block && block.dataset ? block.dataset.ifgPreset : '';
    const t = (typeof window !== 'undefined' && window.GRID_IFG_PRESETS) ? window.GRID_IFG_PRESETS[key] : null;
    return (t && _hexOk(t.iconColor)) ? String(t.iconColor).toLowerCase() : null;
  } catch (_) { return null; }
}

/** 뿌리 `<svg …>` 에 `style="color:#xxxxxx"` 를 ★박는다(이미 style 이 있으면 ★그 속성을 갈아끼운다).
 *  ⛔그 자리가 ★없으면 grid-infographic `_recolor` 가 색을 못 찾는다 — 그게 이 함수의 ★유일한 까닭이다.
 *  ★뿌리 ★한 칸만 본다(`<svg` 로 시작하는 첫 여는 태그) — 안쪽 svg·style 은 안 건드린다.
 *  ⚠️`<svg` 로 시작하지 않으면 ★그대로 돌려준다(판정은 `ifgSvgToIconSrc` 가 한다 — 한 자리에서). */
export function ifgPaintSvgRoot(svgText, hex) {
  const s = String(svgText == null ? '' : svgText);
  const m = /^\s*<svg\b[^>]*>/i.exec(s);
  if (!m) return s;
  const col = _hexOk(hex) ? String(hex).toLowerCase() : DEFAULT_COLOR;
  const tag = m[0]
    .replace(/\sstyle\s*=\s*"[^"]*"/i, '')
    .replace(/\sstyle\s*=\s*'[^']*'/i, '')
    .replace(/(\/?)>$/, ' style="color:' + col + '"$1>');
  return s.slice(0, m.index) + tag + s.slice(m.index + m[0].length);
}

/** iconify 가 준 svg → 그 칸의 `imgSrc`(data URI). ★`<svg>` 가 아니면 ★null.
 *  ⚠️null 이 오는 실제 갈래 = 네트워크 429/프록시 ⇒ `_doInsert` 가 `<img src=…>` ★문자열을 준 때.
 *    ⛔그걸 싸서 넣으면 칸에 ★svg 아닌 것이 들어가 깨진 그림이 되고 ★저장본에도 남는다. */
export function ifgSvgToIconSrc(svgText, hex) {
  const s = String(svgText == null ? '' : svgText);
  if (!/^\s*<svg[\s>]/i.test(s)) return null;
  return URI_HEAD + _b64(ifgPaintSvgRoot(s, hex));
}

/* ══ 더블클릭 판정 ═══════════════════════════════════════════════════════ */

/** 「이 더블클릭은 아이콘 고르개의 것인가」 — 맞으면 {r,c,li,color}, 아니면 null.
 *  ★판정만 한다(모달을 안 연다) — 그래서 ★유닛이 ★이 자를 직접 재고, 모달 없이 ★음성대조를 세운다. */
export function ifgIconPickTarget(block, frame) {
  if (!block || !block.dataset || !block.dataset.ifgPreset || !frame || !frame.dataset) return null;
  const r = Number(frame.dataset.r), c = Number(frame.dataset.c), li = Number(frame.dataset.line);
  if (!Number.isInteger(r) || !Number.isInteger(c) || !Number.isInteger(li)) return null;

  let line = null;
  try { line = window.getGridModel?.(block)?.cells?.[r]?.[c]?.lines?.[li] || null; } catch (_) { line = null; }
  if (!line || line.type !== 'image') return null;
  if (!ifgIsIconSrc(line.imgSrc)) return null;         // ★사진이다 — 옛 길(크롭 편집)로 넘긴다
  /* 색 — ⑴ 그 아이콘에 박힌 색 ⑵ 못 읽으면(외부화·빈 슬롯) 그 블럭 프리셋의 아이콘 색 ⑶ 둘 다 없으면 null(기본색).
     ⛔⑵를 빼면 외부화된 「구분선」 인포그래픽에서 아이콘을 갈 때마다 #111111 이 #222222 로 ★조용히 밝아진다. */
  return { r, c, li, color: ifgIconSrcColor(line.imgSrc) || _presetIconColor(block) };
}

/** 고른 아이콘을 그 칸에 넣는다 — ★문 하나(`window.updateGridBlock`). 못 넣으면 null.
 *  ★★입구는 ★둘인데 ★길은 ★하나다 — ⑴팝오버의 ★내장 35종 ⑵「더 찾기」의 ★iconify. ⛔커밋 경로를 둘로 만들지 마라.
 *    둘 다 `{ name, svg }` 꼴로 들어온다(내장은 prefix 없는 `'leaf'` · iconify 는 `'ph:leaf-bold'`).
 *  ★`picked` = openIconifyModal 이 주는 그 객체와 ★같은 꼴. ⛔`picked.size` 는 ★안 쓴다(크기는 프리셋 몫 · hideSize).
 *  ⚠️넣는 값은 `data:image/svg+xml` 이다 — 외부화된(`goya-asset://…svg`) 칸을 갈면 ★그 한 칸만 다시 인라인이 된다.
 *    여기서 자산 파일을 쓸 길이 없고(쓰기는 설정의 외부화 기능 몫) 아이콘 하나는 ~1KB 다.
 *    ⇒ 다시 줄이려면 설정 「이미지 외부화」를 한 번 더 돌리면 된다. ⛔이 자리에 새 외부화 길을 만들지 마라. */
export function ifgCommitIcon(block, target, picked) {
  if (!block || !target || !picked) return null;
  const imgSrc = ifgSvgToIconSrc(picked.svg, target.color);
  if (!imgSrc) {                                       // ★svg 가 아니다(429/프록시 폴백) — ⛔박지 않는다
    window.showToast?.('아이콘을 못 받았습니다 — 잠시 뒤 다시 시도해 주세요(iconify 응답 제한)');
    return null;
  }
  const res = window.updateGridBlock?.(block.id,
    { patchCell: { r: target.r, c: target.c, lineIndex: target.li, imgSrc } }, { trusted: true });
  window.grdToastImgFail?.(res);
  return res;
}

/** block-drag.js 의 그리드 dblclick 위임이 ★«먼저» 이걸 묻는다. true = 내가 처리했다(가로챘다).
 *  false = 내 일이 아니다 ⇒ 호출부가 ★옛 두 가지(빈 슬롯 파일창 · 프레임 크롭 편집)로 흘려보낸다.
 *  ★여는 것은 ★«팝오버»다(모달이 아니다) — iconify 모달은 그 안의 ★「더 찾기」가 연다.
 *    ⇒ 시안이 요구한 「칸 옆에 뜨는 패널」이 ★살고, iconify 의 243세트도 ★한 번 더 눌러 ★닿는다. */
export function ifgIconDblclick(block, frame) {
  const target = ifgIconPickTarget(block, frame);
  if (!target) return false;
  /* ★여는 자는 `window` 에서 ★«부를 때» 뜬다 — 이 레포의 다리 관례(grid-infographic `window.ifgNewShape` 선례).
     ★덤으로 유닛이 그 자리를 갈아끼워 «팝오버가 ★몇 번 떴나»를 ★센다 ⇒ 「표식 없으면 0건」이 재는 자를 갖는다. */
  const open = (typeof window !== 'undefined' && window.openIfgIconPopover) || openIfgIconPopover;
  /* ⚠️팝오버를 ★못 띄웠으면 false — 「가로채 놓고 아무 일도 안 난다」가 ★제일 나쁘다(옛 길이 그대로 살게). */
  if (!open(frame, (picked) => {
    const res = ifgCommitIcon(block, target, picked);
    /* ★iconify 에서 온 것만 룩을 적는다(내장 손잡이는 prefix 가 없어 `ifgRememberLook` 이 null 을 낸다).
       ★커밋이 ★선 뒤에 적는다 — 커밋이 거절되면(429 폴백) ★룩도 안 바꾼다.
       ⛔await 하지 않는다 — 접미사 조회가 네트워크다. 늦게 와도 `data-*` 는 다음 열 때 읽힌다. */
    if (res && res.ok) { try { ifgRememberLook(block, picked && picked.name); } catch (_) {} }
  }, ifgIconLook(block))) return false;
  return true;
}

/* ══ 내장 35종을 쓰는 도구 ═══════════════════════════════════════════════ */
export const IFG_ICON_VB = '-4.5 -4.5 33 33';        // 원형 틀에 선이 안 잘리게 24 상자 둘레 4.5 여백(자리표시와 같은 값)
export const IFG_ICON_PREVIEW_VB = '0 0 24 24';      // 팝오버 미리보기(네모 단추라 여백이 필요 없다 · 시안 그대로)
const _byName = new Map(IFG_ICONS.map(i => [i.name, i]));
/** 명부에서 하나 — 없으면 null. ⛔날 객체로 담지 않는다('constructor' 같은 이름이 통과한다). */
export function ifgIconDef(name) { return _byName.get(String(name == null ? '' : name)) || null; }
if (_byName.size !== IFG_ICONS.length) {
  throw new Error('[grid-ifg-icon-pick] 빠른 손잡이 명부에 이름이 겹친다 — ' + IFG_ICONS.length + '개 중 ' + _byName.size + '개만 유일하다');
}

/** 내장 아이콘의 캔버스용 svg — ★뿌리 `style="color:…"` ＋ currentColor(색 계약은 ifgPaintSvgRoot 와 같은 꼴). */
export function ifgIconSvgMarkup(name, color) {
  const def = ifgIconDef(name);
  if (!def) return '';
  const col = _hexOk(color) ? String(color).toLowerCase() : DEFAULT_COLOR;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + IFG_ICON_VB + '" style="color:' + col + '"'
    + ' fill="' + (def.fill || 'none') + '" stroke="currentColor" stroke-width="2"'
    + ' stroke-linecap="round" stroke-linejoin="round">' + def.path + '</svg>';
}
/** 내장 아이콘의 data URI. 명부 밖 이름이면 ''. */
export function ifgIconDataUri(name, color) {
  const svg = ifgIconSvgMarkup(name, color);
  return svg ? URI_HEAD + _b64(svg) : '';
}

/* 검색 — 이름 «또는» 한글 별칭. 빈 질의 = 전부. ★NFC(macOS 자모 분리형 함정) 양쪽 정규화. */
const _nfc = (s) => { const t = String(s == null ? '' : s); try { return t.normalize('NFC'); } catch (_) { return t; } };
const _hay = (def) => _nfc(def.name + ' ' + def.aliases).toLowerCase();
const _HAYS = new Map(IFG_ICONS.map(d => [d.name, _hay(d)]));
export function ifgIconSearch(q) {
  const needle = _nfc(q).trim().toLowerCase();
  if (!needle) return IFG_ICONS.slice();
  const parts = needle.split(/\s+/).filter(Boolean);
  return IFG_ICONS.filter(d => parts.every(p => _HAYS.get(d.name).indexOf(p) >= 0));
}

/* ══ ★세트·스타일(패밀리룩) 기억 ═══════════════════════════════════════════
 * ★어디에 적나 — 블럭의 ★`data-ifg-icon-set` · `data-ifg-icon-variant`.
 *   ★왜 grid-block.js 를 ★안 건드리나 — ★선례가 있다: js/props/label-auto-color.js:9
 *     「★표식은 ★data 속성이라 ★저장(sanitizeCanvasHtml 은 on* 만 제거)·undo(HTML 스냅샷)를 ★그대로 따라간다」
 *   ⇒ 저장본은 ★캔버스 ★HTML 문자열이라(js/io/save-load.js `canvas`) ★data-* 가 ★왕복한다.
 *   ⛔`updateGridBlock` 의 필드 명부에 ★넣지 않는다 — 그 입구는 「모르는 이름 거절」이고, 명부를 늘리면
 *     getGridModel·직렬화·게이트가 ★같이 늘어난다(「가장 적은 코드」가 아니다).
 * ★`set` 은 ★추측이 0 이다 — iconify 이름 `prefix:name` 의 ★`prefix` 그대로.
 * ★★`variant` 는 ★추측하지 ★않는다 — ⛔「마지막 하이픈 뒤」로 떼면 `arrow-up-down` 이 variant `down` 이 된다.
 *   ⇒ ★그 세트의 ★`suffixes` 를 ★API 에서 ★한 번 받아(세트당 1회 · 캐시) ★그 명부에 ★있는 접미사만 떼낸다.
 *   ★실측(2026-10-20 · 세트당 1회 · 7초 간격):
 *       ph     total 9072  suffixes 6 → {"thin":"Thin","light":"Light","":"Regular","bold":"Bold","fill":"Fill","duotone":"Duotone"}
 *       tabler total 6238  suffixes ★0 (스타일 변주가 없다)
 *       lucide total 1891  suffixes ★0
 *     ⇒ `""` 가 ★Regular 이다. ⛔그래서 ★빈 variant 는 ★「모름」이 아니라 ★「Regular」일 수 있다.
 *   ⚠️못 받으면(오프라인·429) ★variant 는 ★빈 값으로 두고 ★set 만 적는다 — ⛔지어내지 않는다. */
const LOOK_DEFAULT_SET = 'lucide';   // ★내장 35종이 lucide 선 그림 꼴이라 ★같은 패밀리로 둔다(선기반·단색·1891종)
const _SUFFIX_CACHE = new Map();     // prefix → string[] (긴 것 먼저) | null(못 받았다)

/** 그 블럭이 기억한 룩. 없으면 기본 세트 ＋ 빈 스타일. */
export function ifgIconLook(block) {
  const d = (block && block.dataset) || {};
  const set = typeof d.ifgIconSet === 'string' && d.ifgIconSet ? d.ifgIconSet : LOOK_DEFAULT_SET;
  const variant = typeof d.ifgIconVariant === 'string' ? d.ifgIconVariant : '';
  return { set, variant };
}

/** 그 세트의 접미사 명부 — ★세트당 ★1회만 받고 캐시한다(⛔낱개 몰아쏘기 금지 · :301 의 429). */
async function _suffixesOf(prefix) {
  if (_SUFFIX_CACHE.has(prefix)) return _SUFFIX_CACHE.get(prefix);
  let out = null;
  try {
    const res = await fetch('https://api.iconify.design/collection?prefix=' + encodeURIComponent(prefix));
    if (res.ok) {
      const d = await res.json();
      /* ⛔빈 키('' = Regular)는 접미사로 떼낼 것이 없다 — 긴 것부터 보도록 정렬한다. */
      out = Object.keys((d && d.suffixes) || {}).filter(Boolean).sort((a, b) => b.length - a.length);
    }
  } catch (_) { out = null; }
  _SUFFIX_CACHE.set(prefix, out);
  return out;
}

/** 고른 iconify 이름(`solar:leaf-bold`)에서 ★세트와 ★스타일을 적는다. ★스타일은 ★증명되면만 적는다.
 *  ⛔`updateGridBlock` 을 안 탄다 — ★표식이라 ⌘Z 의 HTML 스냅샷을 그대로 따라간다(label-auto-color 선례). */
export async function ifgRememberLook(block, iconifyName) {
  if (!block || !block.dataset || typeof iconifyName !== 'string') return null;
  const i = iconifyName.indexOf(':');
  if (i <= 0) return null;                            // 내장 손잡이(prefix 없음) — 룩을 안 건드린다
  const set = iconifyName.slice(0, i), nm = iconifyName.slice(i + 1);
  block.dataset.ifgIconSet = set;
  const sufs = await _suffixesOf(set);
  if (!Array.isArray(sufs)) return { set, variant: null };   // 못 받았다 — ⛔지어내지 않는다
  const hit = sufs.find(sx => nm.length > sx.length + 1 && nm.endsWith('-' + sx)) || '';
  block.dataset.ifgIconVariant = hit;
  return { set, variant: hit };
}

/* ══ 팝오버 ════════════════════════════════════════════════════════════════
 * ★시안 구조 — 검색칸 ＋ 아이콘 격자. ＋ ★「더 찾기」 한 줄(iconify 로 가는 문).
 * ★검색칸은 공용 `prop-input`(css/editor-props.css) 그대로.
 * ⛔격자 단추에 `prop-icon-btn` 은 ★안 쓴다 — 그 `:hover` 가 `color: var(--ui-danger)` ★빨강이다(삭제 단추용).
 * ★hover 는 인라인으로 못 적는다 ⇒ `<style>` 한 벌을 head 에 ★한 번(선례 = iconify-panel.js:459 `_style`).
 * ★`position:fixed` — 캔버스는 `#canvas-scaler` 로 배율이 걸려 있다(안에 넣으면 팝오버까지 줄어든다).
 * ★이름·별칭은 ★«글자»로 넣는다(setAttribute/textContent) — ⛔새 HTML esc 사본을 만들지 않는다
 *   (tests/unit/name-axes-to-markup.test.mjs X9 가 그 증식을 막는다 — 전엔 여기 37번째 사본이 있었다). */
const POP_ID = 'grd-ifg-iconpop';
const POP_W = 268, POP_PAD = 10;
let _pop = null, _popOff = null;

if (typeof document !== 'undefined' && document.head && !document.getElementById(POP_ID + '-css')) {
  const st = document.createElement('style');
  st.id = POP_ID + '-css';
  st.textContent = `
  .${POP_ID}-btn {
    width: 100%; aspect-ratio: 1 / 1; display: inline-flex; align-items: center; justify-content: center;
    background: transparent; color: var(--ui-text-muted); border: 1px solid transparent;
    border-radius: 4px; cursor: pointer; padding: 0;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }
  .${POP_ID}-btn:hover { background: var(--ui-bg-hover); color: var(--ui-text); border-color: var(--ui-border-mid); }
  .${POP_ID}-btn:focus-visible { outline: none; border-color: var(--ui-accent-primary); }
  .${POP_ID}-more {
    width: 100%; margin-top: 8px; padding: 6px 8px; font-size: 11px; cursor: pointer;
    background: var(--ui-bg-input); color: var(--ui-text-sub);
    border: 1px solid var(--ui-border); border-radius: 4px;
  }
  .${POP_ID}-more:hover { background: var(--ui-bg-hover); color: var(--ui-text); border-color: var(--ui-border-mid); }
  .${POP_ID}-more:disabled { opacity: .45; cursor: default; }
  .${POP_ID}-upload {
    width: 100%; margin-top: 6px; padding: 6px 8px; font-size: 11px; cursor: pointer;
    background: var(--ui-bg-input); color: var(--ui-text-sub);
    border: 1px solid var(--ui-border); border-radius: 4px;
  }
  .${POP_ID}-upload:hover { background: var(--ui-bg-hover); color: var(--ui-text); border-color: var(--ui-border-mid); }
`;
  document.head.appendChild(st);
}

/** 격자를 다시 채운다 — 시안의 `data-z3-pick` → `data-ifg-pick`. */
function _fillGrid(gridEl, list) {
  gridEl.textContent = '';
  if (!list.length) {
    const none = document.createElement('div');
    none.style.cssText = 'grid-column:1/-1;text-align:center;font-size:11px;color:var(--ui-text-dim);padding:18px 0;';
    none.textContent = '맞는 아이콘이 없습니다 — 아래 「더 찾기」로';
    gridEl.appendChild(none);
    return;
  }
  for (const d of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = POP_ID + '-btn';
    b.setAttribute('data-ifg-pick', d.name);
    b.setAttribute('title', d.name + ' · ' + d.aliases);
    b.innerHTML = '<svg width="18" height="18" viewBox="' + IFG_ICON_PREVIEW_VB + '" fill="' + (d.fill || 'none') + '"'
      + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + d.path + '</svg>';
    gridEl.appendChild(b);
  }
}

export function closeIfgIconPopover() {
  if (_popOff) { _popOff(); _popOff = null; }
  if (_pop && _pop.parentNode) _pop.parentNode.removeChild(_pop);
  _pop = null;
}

/** 칸의 아이콘 프레임 옆에 팝오버를 띄운다.
 *  onPick({ svg, name }) — ★내장은 `{svg, name:'leaf'}`(prefix 없음) · 「더 찾기」는 iconify 의 `{svg, name:'ph:leaf-bold'}`.
 *  ⇒ ★커밋 경로는 ★하나다(ifgCommitIcon) — ⛔둘로 만들지 마라.
 *  ★opts(넷째 · 113 ITB-PHOTO-UPLOAD-DOOR-01) — `{ onUpload }` 가 함수일 때만 「사진 올리기」 단추를 그린다. 기본 꺼짐.
 *    켜는 쪽은 아이콘 텍스트 블럭(block-drag.js) 하나 — ⛔인포그래픽 칸(ifgIconDblclick)은 안 켠다(「이미지 넣을 일이 없어」).
 *    ★«사진»은 아이콘 커밋이 아니다 — 이 파일은 단추만 그리고, 올리기·이력·저장은 부르는 쪽 몫이다(onUpload). */
export function openIfgIconPopover(anchorEl, onPick, look, opts) {
  if (typeof document === 'undefined' || !document.body) return null;
  closeIfgIconPopover();
  const pickCb = typeof onPick === 'function' ? onPick : null;
  const lk = look || { set: LOOK_DEFAULT_SET, variant: '' };
  const onUpload = opts && typeof opts.onUpload === 'function' ? opts.onUpload : null;

  const el = document.createElement('div');
  el.id = POP_ID;
  el.className = POP_ID;
  /* ★색·보더는 공용 토큰(css/editor-base.css :root) — ⛔새 색을 만들지 않는다. 그림자만 리터럴(토큰 없음). */
  el.style.cssText = 'position:fixed;z-index:9998;width:' + POP_W + 'px;box-sizing:border-box;'
    + 'background:var(--ui-bg-card);border:1px solid var(--ui-border);border-radius:10px;padding:' + POP_PAD + 'px;'
    + 'box-shadow:0 14px 38px rgba(0,0,0,0.6);font-family:Pretendard,-apple-system,sans-serif;';
  /* ★뼈대는 데이터가 안 섞인 상수 마크업뿐 — 알맹이는 `_fillGrid`·`textContent` 가 «글자»로 넣는다. */
  el.innerHTML = '<input type="text" class="prop-input ' + POP_ID + '-search"'
    + ' placeholder="아이콘 검색 — 예: 세척 · 배터리 · leaf" autocomplete="off" spellcheck="false"'
    + ' style="width:100%;box-sizing:border-box;font-size:11px;height:26px;">'
    + '<div class="' + POP_ID + '-grid" style="margin-top:8px;display:grid;'
    + 'grid-template-columns:repeat(7,1fr);gap:4px;max-height:208px;overflow-y:auto;"></div>'
    + '<button type="button" class="' + POP_ID + '-more"></button>'
    + (onUpload ? '<button type="button" class="' + POP_ID + '-upload" data-ifg-upload>사진 올리기</button>' : '');
  _fillGrid(el.querySelector('.' + POP_ID + '-grid'), IFG_ICONS);
  document.body.appendChild(el);
  _pop = el;                               // ★닫는 자가 이 칸을 읽는다 — ⛔비워 두면 팝오버가 안 사라진다

  const more = el.querySelector('.' + POP_ID + '-more');
  const canMore = typeof window !== 'undefined' && typeof window.openIconifyModal === 'function';
  /* ★기억한 룩을 ★글자로 보여 준다 — 「무엇 안에서 고르는지」가 안 보이면 통일이 우연처럼 느껴진다. */
  more.textContent = canMore
    ? '더 찾기 — iconify · ' + lk.set + (lk.variant ? ' / ' + lk.variant : '')
    : '더 찾기를 쓸 수 없습니다 (아이콘 고르개 미적재)';
  /* ⚠️⛔«조용히 죽지» 않게 — 못 쓰면 ★막고 ★말한다(「눌리는데 아무 일도 안 난다」가 이 레포의 고질이다). */
  more.disabled = !canMore;

  /* 자리 — 앵커 아래. 화면을 넘으면 위로·안으로 민다(DOM 을 붙인 «뒤»에 재야 높이가 참값이다). */
  const r = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
  const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
  const h = el.offsetHeight || 290;
  let left = r ? r.left : 40, top = r ? r.bottom + 8 : 40;
  if (left + POP_W > vw - 8) left = Math.max(8, vw - POP_W - 8);
  if (top + h > vh - 8) top = Math.max(8, (r ? r.top - 8 - h : 8));
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';

  const search = el.querySelector('.' + POP_ID + '-search');
  const grid = el.querySelector('.' + POP_ID + '-grid');
  const take = (payload) => {
    closeIfgIconPopover();                 // ★먼저 닫는다 — 콜백이 재렌더를 돌려 앵커를 날린다
    if (pickCb && payload) pickCb(payload);
  };
  const pickBuiltIn = (name) => {
    const def = ifgIconDef(name);
    if (def) take({ name, svg: ifgIconSvgMarkup(name, null), builtIn: true });
  };
  const redraw = () => { _fillGrid(grid, ifgIconSearch(search.value)); };

  search.addEventListener('input', redraw);
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeIfgIconPopover(); return; }
    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      const first = ifgIconSearch(search.value)[0];
      if (first) pickBuiltIn(first.name);
    }
  });
  grid.addEventListener('click', e => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-ifg-pick]') : null;
    if (!btn) return;
    e.stopPropagation();
    pickBuiltIn(btn.dataset.ifgPick);
  });
  more.addEventListener('click', e => {
    e.stopPropagation();
    if (!canMore) return;
    /* ★팝오버를 먼저 닫고 ★모달을 연다 — 둘이 겹치면 바깥클릭 가드가 서로를 닫는다.
       ★`prefix` 로 ★기억한 세트를 미리 걸러 연다(iconify-panel.js openIconifyModal options.prefix).
       ★`hideSize` — 아이콘 크기는 ★프리셋이 쥔다(iconSize 144/84) ⇒ ⛔picked.size 를 안 쓴다. */
    const open = window.openIconifyModal;
    closeIfgIconPopover();
    open((picked) => take(picked), { hideSize: true, prefix: lk.set });
  });
  const upload = el.querySelector('.' + POP_ID + '-upload');
  if (upload) upload.addEventListener('click', e => {
    e.stopPropagation();
    /* ★먼저 닫고 «같은 클릭 안에서» 부른다 — 파일 선택창은 사용자 클릭 안에서만 뜬다(⛔await·setTimeout 끼우지 마라). */
    closeIfgIconPopover();
    onUpload();
  });
  /* ⛔클릭·키를 캔버스로 흘리지 않는다 — 블럭 선택·단축키가 같이 돈다. */
  el.addEventListener('mousedown', e => e.stopPropagation());
  el.addEventListener('dblclick', e => e.stopPropagation());

  const onDocDown = (e) => { if (!el.contains(e.target)) closeIfgIconPopover(); };
  const onDocKey = (e) => { if (e.key === 'Escape') closeIfgIconPopover(); };
  /* 캡처 단계 — 캔버스 쪽 리스너가 stopPropagation 을 걸어도 바깥 클릭이 닫히게. */
  document.addEventListener('mousedown', onDocDown, true);
  document.addEventListener('keydown', onDocKey, true);
  _popOff = () => {
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onDocKey, true);
  };

  try { search.focus(); } catch (_) {}
  return el;
}

if (typeof window !== 'undefined') {
  window.ifgIconDblclick = ifgIconDblclick;          // ★block-drag.js 가 «부를 때» 읽는다(import 안 한다 — 기존 관례)
  window.ifgIconPickTarget = ifgIconPickTarget;
  window.ifgCommitIcon = ifgCommitIcon;
  window.ifgSvgToIconSrc = ifgSvgToIconSrc;        // ★1017t1m2 — 아이콘 텍스트 블럭(block-drag.js)이 같은 변환을 쓴다
  window.ifgPaintSvgRoot = ifgPaintSvgRoot;
  window.openIfgIconPopover = openIfgIconPopover;
  window.closeIfgIconPopover = closeIfgIconPopover;
  window.ifgIconSearch = ifgIconSearch;
  window.IFG_ICONS = IFG_ICONS;
}

