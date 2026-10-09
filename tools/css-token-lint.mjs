#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   css-token-lint — 우리판 CSS 토큰 린터 (1009t3 ⑥)

   ══ 무엇을 재나 ═══════════════════════════════════════════════════════════
   «기준판 이후 새로 쓰인 CSS 줄»에서 ⑴ 하드코딩 hex 색 ⑵ 하드코딩 px 길이를
   찾고, **그 값에 맞는 우리 토큰이 있을 때만** 빨강을 낸다.
   에러 문구에 «쓸 토큰 이름»을 박아 준다 — 고치는 쪽(사람이든 에이전트든)이
   이 자의 출력만 보고 스스로 고칠 수 있게 하는 것이 이 자의 목적이다.
   ★예시는 ★지어내지 않는다 — 아래는 2026-10-10 산 트리에서 ★실제로 나온 줄이다:
     css/editor-panels.css:140:18  하드코딩 길이 `border-radius: 6px`  ⇒ ★var(--ui-radius-md) 를 쓰라
     css/editor-graph.css:213:59   하드코딩 길이 `gap: 4px`            ⇒ ★var(--ui-row-gap) 를 쓰라

   ══ 무엇을 «안» 재나 (⛔이 칸을 지우지 마라 — 다음 사람이 이 자를 넓게 믿는다) ══
   ⒜ «기준판 이전»부터 있던 줄 — 안 본다. 범위 밖이다(아래 「범위」).
      ⇒ ⛔이 자가 초록이라는 것은 「이 레포에 하드코딩이 없다」가 ★아니다.
        전체 css/*.css 에는 hex 1,110건 · px 3,723건이 있다(2026-10-10 실측).
   ⒝ 커스텀 프로퍼티 «정의» 줄(`--x: #d8d8d8;`) — 토큰 값은 리터럴로 쓸 수밖에 없다.
      ⇒ 범위 안 hex 23건 중 13건이 이 꼴이라, 안 거르면 이 자는 즉시 소음이 된다.
   ⒞ `var(--x, #fff)` 의 «대체값» — 이미 토큰을 먼저 쓰는 꼴이라 건드리지 않는다.
      (var( … ) 괄호 안은 통째로 면제한다.)
   ⒟ `url( … )` 안 — data:image/svg+xml 의 `%23666` 같은 자리.
   ⒠ 주석 안 — 파일 전체를 CSS 문법으로 훑어 주석·문자열을 먼저 «빈칸»으로 만든다.
      (범위 안 hex 42건 중 19건이 주석이었다. 줄 단위로 벗기면 여러 줄 주석을 놓친다.)
   ⒡ rgba()/hsl() 리터럴 — 값이 rgba «만»인 :root 토큰이 15종 있는데도 안 본다
      (현빈 요구가 「하드코딩 hex/px」였다). ⇒ ★여기가 ★가장 큰 빈 칸이다.
   ⒢ «토큰이 없는» 값 — 조용히 지나간다. ⛔경고도 안 낸다(소음이 자를 죽인다).
   ⒣ px 중 property 가 안 맞는 자리 — 아래 「px 판정 기준」.
   ⒤ CSS 가 아닌 자리의 하드코딩 — js 의 인라인 스타일·html 의 style= 는 안 본다.
      (`css/` 밖의 .css 도 안 본다 — assets/fonts/pretendard.css · vendor/xterm/xterm.css ·
       .tmp_removed/ 는 남의 것이거나 죽은 것이다.)
   ⒥ ★이 자의 ★자기대조가 ★안 재는 가드가 하나 있다 — `scanDeclarations` 의
      「`:` 가 없으면 선언이 아니다」 조기반환. 끄고 돌려 봤더니 `--self` 14칸도,
      산 트리의 건수(기본 4 · --all 445)도 ★하나도 안 움직였다(2026-10-10 실측).
      ⇒ 지금은 ★«재는 자가 없는» 가드다. 고치려면 그 가드를 ★무력화했을 때 빨개지는
        표본을 ★먼저 만들어라. ⛔「있으니 돈다」로 믿지 마라.
      ★★같은 꼴이 ★하나 더 있다(2026-10-10) — `refSource` 의 「0바이트면 터뜨린다」 가드.
        끄고 돌려도(n3) ★검사 28칸이 ★전부 초록이었다. ⇒ ★역시 ★재는 자가 없다.

   ══ 범위 — 왜 「바뀐 줄」만 보나 ═══════════════════════════════════════════
   전체를 보면 hex 1,110 + px 3,723 = 4,833건이 쏟아진다. 그 수로는 아무도 안 쓴다
   (현빈 지시 2026-10-10: 「범위: 0.9.5 이후 바뀐 CSS 줄만」).
   ══ ⛔이 자에 대해 ★말하면 안 되는 문장들 (★한 번씩 다 틀렸다) ═══════════════
   ⛔「릴리스가 이 게이트를 통과했다」 — ★거짓일 수 있다. CI 가 얕은 checkout 이면
     태그가 없어 ★SKIP 한다. ★참이려면 로그에서 ★SKIP 두 줄이 ★없음을 봐야 한다.
   ⛔「이 레포에 하드코딩이 없다」 — 이 자는 ⑴범위 안 ⑵토큰이 있는 자리만 본다.
   ⛔★★「범위 안 하드코딩 0건」 — ★출력의 ★「거르개 정합」 줄을 ★같이 봐야 참이다.
     ★2026-10-10 ★한 번 그 일이 났다: css/editor-layout.css 를 ★669행까지만 봤다
     (790줄 중 · 선언 479/558). ★Ⓑ 로 고쳤고 ★지금은 ★25/25 · 안 본 자리 0건이다.
     ⇒ ★그래도 ★그 줄을 ★먼저 보라 — ★다음 실명은 ★다른 꼴로 온다.
   ⛔「색 하드코딩을 잡는다」 — ★hex 만 본다. rgba «만»인 :root 토큰 15종엔 안 닿는다.
   ⛔「px 하드코딩을 잡는다」 — ★font-size·border-radius·gap ★세 property 의 px 만.
     ★넓히려면 ★코드가 아니라 ★«표»를 넓혀라(아래 「px 판정 기준」).
   ⛔`--all` 의 수를 «결함 수»로 ★읽지 마라 — 범위 밖까지 센 수다(출력에도 박아 뒀다).
   ⛔「0건이라 싸다」를 ★팀 전체로 말하지 마라 — ★레인마다 다르다(아래 「폭발 반경」).

   ══ 기준판 — ⛔박지 않는다. ★파생한다 ═══════════════════════════════════════
   ★처음엔 `DEFAULT_BASE = 'v0.9.5'` 로 ★박아 뒀고, ★★하루 만에 낡았다(2026-10-10):
     origin/main = 9de05e189791 = ★v0.9.6 ★그 자체 · GitHub 릴리스 0.9.6 Latest ·
     package.json 0.9.6 ★인데 자는 ★v0.9.5 를 보고 있었다.
   ⇒ ★그 문자열이 ★둘째 명부였다(「명부가 둘이면 경고 주석으로 못 막는다 — 파생시켜 하나로」).
   ★지금은 `deriveBase()` 가 ★origin/main(없으면 main)의 ★최신 릴리스 태그를 뽑는다.
     ★★«두 길»로 구해 ★견준다 — `describe --abbrev=0` 와 `tag --merged --sort=-v:refname`.
     ⛔둘이 ★갈리면 ★고르지 않는다 — {ok:false} 로 ★사람이 보게 한다.
     ⛔못 뽑으면 ★박아둔 값으로 ★폴백하지 ★않는다 — 폴백하면 「기준판이 낡았다」가
       ★영영 안 보인다(★실제로 그 일이 났다). CLI=HARNESS_ERROR(3) · 검사=SKIP(까닭 찍고).
     `--base <ref>` 는 override 이고, ★쓰면 출력에 ★「--base 로 손으로 줬다」가 박힌다.
   ★★⚠️이 창은 ★릴리스마다 ★좁아진다 — 그래서 매 실행마다 ★직전 태그 기준 범위를
     ★같이 찍는다(「직전 태그 v0.9.5 기준 818줄 → 지금 547줄 (-271줄)」).
     ⛔조용히 좁아지면 「조용히 낮아진 기준선」이 되고, 그건 빨간 검사보다 나쁘다.
   ★v0.9.5 는 HEAD 의 «조상이 아니었다»(main 쪽 머지 커밋) — 그래서 이 자는 ★항상
     `git merge-base <base> <잴 것>` 을 먼저 잡는다. ⛔두-점 diff 는 양방향이라 안 쓴다.

   ★★«낡은 기준판»이 어느 쪽으로 틀리나 — ★수로 (2026-10-10 · 내 레인):
       base=v0.9.4  범위 995줄 → 적발 11건
       base=v0.9.5  범위 818줄 → 적발  0건   ← 박아 뒀던 값
       base=v0.9.6  범위 547줄 → 적발  0건   ← 파생되는 값
     ⇒ ★★낡은 기준판은 «덜» 보는 게 아니라 ★«더» 본다 ⇒ 해는 ★눈먼 것이 아니라 ★소음이다.
     ★고치기 전 판(417d220e)에서 재면: 적발 4건 중 ★v0.9.6 창 안은 ★2건뿐이었다
       (editor-blocks:1426 · editor-graph:213 은 ★0.9.6 에 이미 실려 나간 줄이었다).
     ⇒ ★★그래서 ★반대 위험도 참이다 — 릴리스가 나면 ★그 전에 쓴 하드코딩은 ★창 밖으로
       나간다. ★이 자는 「릴리스 뒤에 쓴 줄」만 본다. ★그게 설계이고, ★한계다.

   ★「바뀐 줄」을 잡는 법 — `git diff -U0 <merge-base> -- css/*.css` 의 `+` 줄.
     ⛔「고른 것」이지 「유일한 답」이 아니다. 네 가지로 재 봤고 수가 갈렸다(2026-10-10):
        818  git diff -U0        «+» 줄            ← 이 자가 쓰는 것
        822  git diff --numstat / 기본 맥락(-U3)
        830  git blame, 「마지막으로 만진 커밋이 기준판에서 안 보이면 새 줄」
        797  git blame -w -M -C
     까닭:
      · 822−818=4 — editor-layout.css 의 ★빈 줄 2 + `}` 2. -U0 은 더 «짧은» 편집
        대본을 뽑아 그 넷을 맥락으로 돌린다. 넷 다 hex·px 가 0개라 ★이 자의
        적발 집합은 두 수에서 ★똑같다(확인했다).
      · 830−822=8 — blame 은 «지웠다 되살린 줄»·«고쳤다 원래 글자로 되돌린 줄»도
        새 줄로 센다. diff 는 양 끝만 보니 그 줄이 사라진다.
      · 830−797=33 — `-M -C` 는 «옮겨온 블록»을 원래 커밋 몫으로 돌린다. 옮긴 줄은
        blame -M 으론 「새 내용 아님」이지만 diff 로는 `+` 줄이다.
     ⇒ diff 를 고른 까닭: ⑴ 양 끝 트리만 비교해 커밋 그래프에 안 의존한다
        ⑵ 「이 글자가 지금 트리에 있고 기준판 트리엔 없었다」는 ★가장 좁은 «내용» 정의다
        ⑶ 옮겨온 줄도 「그 사람이 지금 그 자리에 쓴 줄」이라 묶는 쪽이 안전하다.

   ══ 토큰 명부 — «정의 자리»에서 센다 ═══════════════════════════════════════
   ⛔`var(--x)` 사용 자리 grep 으로 세지 않는다(거짓양성·거짓음성이 같이 온다).
   css/*.css 를 주석 벗겨 훑어 **`:root { … }` 블록 안의 `--name: value`** 만 명부로
   잡는다 — 실측 166건(design-tokens.css 43 · editor-base.css 121 · editor-props.css 2).
   `:root` 가 아닌 자리의 정의 59건(.text-block 11 · .grid-block … )은 ★안 쓴다:
   그것들은 «그 선택자 안에서만» 사는 지역 변수라, 다른 자리에 「이걸 쓰라」고 할 수 없다.
   `var(--a)` 사슬은 리터럴까지 풀어 둔다(--bg-app → --p-gray-950 → #1a1a1a).

   ══ ★문맥 — ★모르면 ★권하지 않는다 (적대적 QA ⒊-② · 2026-10-10) ═══════════
   ★advqa 가 심었다:
       :root { --ui-bg-card: #ffffff; }
       @media (prefers-color-scheme: dark) { :root { --ui-bg-card: #111111; } }
       .light-only { background: #111111; }   ← ★「var(--ui-bg-card) 를 쓰라」로 ★적발됐다
       .a          { background: #ffffff; }   ← ★적발 0건 (★거짓음성이 ★한 쌍으로 왔다)
     ★그 지시를 따르면 ★라이트에서 `--ui-bg-card` 는 ★#ffffff ⇒ ★★검정이 ★흰색이 된다.
     ★까닭 = ⑴ @media 안의 `:root` 도 ★진짜 :root 로 셌다 ⑵ resolve 가 ★last-wins 라
       ★다크 값이 표를 덮었다 ⇒ ★표에 ★«문맥»이 ★없었다.
   ⇒ ★두 가드:
     ⒜ `:root` 는 ★«at-rule 깊이 0»일 때만 ★명부에 넣는다. @media 안의 것은 ★세기만 하고
        ★출력에 ★「@media 안 :root N건은 ★안 쓴다(문맥 모름)」로 ★찍는다.
     ⒝ 이름이 ★중복인데 ★값이 ★갈리면 ★`resolveTokens` 가 ★그 이름을 ★떨군다.
        ⛔`buildMaps` 에 ★인자로 넘기지 않았다 — 넘기면 ★안 넘긴 호출자가 ★조용히 ★가드 없이
        돈다. ★구조로 잠갔다(모든 소비자가 ★자동으로 받는다). ★떨군 수는 출력에 찍힌다.
   ★지금 이 레포 = @media 안 :root ★0건 · 이름 중복 ★0종 · 값 갈림 ★0종 ⇒ ★수가 ★안 바뀐다
     (실측: :root 166 · 색 35 · 길이 26 · 기본 0건 · --all 441건 ★전부 동일) ⇒ ★들이기 싼 때였다.
   ⛔그래도 ★이 자는 ★테마를 ★모른다 — ★라이트 테마가 생기면(지금은 0건, design-tokens.css
     머리말 실측) ★다크/라이트 ★둘 다 참인 토큰만 권할 수 있다. ★그때 다시 재라.

   ══ 무엇을 «쓰라»고 하나 — 제안 대상 패밀리 ════════════════════════════════
   같은 값을 여러 토큰이 가질 수 있다(#1a1a1a = --p-gray-950 · --ui-bg-app · --preset-h2-color).
   그래서 제안은 ★다음 패밀리만 한다:
     --ui-*                                     정본 UI 토큰 (design-tokens.css 머리말:
                                                「신규 UI 토큰은 editor-base.css :root 의 --ui-*」)
     --color-* --bg-* --border-* --text-*        design-tokens.css 의 semantic 층
   제안에서 ★빼는 것 (까닭을 같이 적는다):
     --p-*            primitive. 그 파일이 「semantic 이 참조하는 원형」이라 적어 뒀다 —
                      직접 쓰라고 하면 2단 계층을 내가 무너뜨린다.
     --preset-*       사용자 «작업물»(상세페이지)의 글자·표 프리셋이다. UI 크롬에 쓰면 틀린다.
     --goya-checker-* 체커보드 전용. --gdt-* 패딩힌트 전용. --cv-* 컬러칩 전용.
                      ★지역 쓰임새라 다른 자리에 권하면 안 된다.
   여러 후보가 남으면 전부 보여 준다(--ui-* 먼저). ⛔하나로 좁혀 찍지 않는다 —
   어느 쪽이 맞는지는 그 줄의 뜻이 정하고, 그건 이 자가 못 읽는다.

   ══ px 판정 기준 — «토큰이 있는 자리»의 정의 ════════════════════════════════
   모든 px 가 토큰 대상이 아니다. px 는 ★값만 같아도 뜻이 다르다
   (4px = border-radius 면 --ui-radius-sm, gap 이면 --ui-row-gap, font-size 면 토큰 없음).
   ⇒ 그래서 px 는 ★«(property, 값)» 짝으로만 맞춘다. 그리고 그 짝은
     ★«토큰 «이름»이 자기 property 를 말하는 것»에서만 만든다:
        --ui-fs-9/10/base(11)/12/13/14/16/20/28  →  font-size
        --ui-radius-sm(4) / md(6) / lg(10)       →  border-radius 와 네 모퉁이 longhand
        --ui-row-gap(4px)                        →  gap · row-gap
   ★일부러 ★안 넣은 px 토큰과 까닭:
        --ui-btn-h / --ui-input-h (24px)  height 는 쓰이는 ★선택자가 정한다 — 버튼이
                                          아닌 24px 를 「버튼 높이를 쓰라」고 하면 틀린다.
        --ui-pad-panel (8px)              padding 8px 가 전부 «패널»은 아니다.
        --ui-chevron(10) --ui-form-label-w(56) --ui-handle-border-w(1.5)   같은 까닭.
        --goya-checker-*-size --cv-chip-*  지역 전용(위 「빼는 것」).
   ⇒ 이 표가 ★이 자의 px 적발 상한이다. 넓히려면 ★표를 넓혀라(코드가 아니라 표다).

   ══ 양성대조 ═══════════════════════════════════════════════════════════════
   `node tools/css-token-lint.mjs --self` 가 매번 14칸을 센다(어긋나면 exit 3).
   tests/unit/css-token-lint.test.mjs 가 `npm test` 에서 같이 돈다.
     전제 2 — 표본이 쓸 토큰 4종이 명부에 ★있나 / ⑻의 표본값이 제안표에 ★없나
              (⛔이 둘이 깨지면 아래 대조는 전부 «0건짜리 초록»이다)
     ⑴⑴b⑴c 양성 — 토큰 있는 값을 범위 «안»에 심으면 ★잡는가 · 문구에 ★토큰 이름이
              나오나 · var() 사슬로만 닿는 토큰(--bg-input)도 ★나오나
     ⑵ 음성  — 이미 var(--x) 를 쓰는 줄은 ★초록인가
     ⑶ 범위밖 — ★같은 하드코딩을 범위 «밖» 줄에 두면 ★안 잡는가  ← 이 자의 핵심 단언
     ⑶b      — 거르개를 «끄면» 그 줄이 ★나타나나 (⑶이 «죽은 음성대조»가 아님을 증명)
     ⑷ 토큰없음 · ⑸ 면제(정의·var 대체값·url) · ⑹ property 불일치 · ⑺ id 선택자
     ⑻ 제안 «대상 아닌» 패밀리뿐인 값 · ⑼ 블록 «안» 주석

   ★★이 14칸은 «세웠다»가 근거가 아니다 — ★무력화해 보고 빨개진 것만 근거다.
     가드를 하나씩 끄고 `--self` 를 돌린 실측 (2026-10-10):
        m1 범위 거르개 off      → ❌3  (⑴ ⑴b ⑶)
        m2 `--x:` 정의 면제 off → ❌3  (⑴ ⑴b ⑸)
        m3 제안 패밀리 거르개 off→ ❌4  (전제② ⑴ ⑴b ⑻)
        m4 주석 벗기기 off      → ❌4  (⑴ ⑴b ⑴c ⑼)
        m5 url/var 면제 off     → ❌3  (⑴ ⑴b ⑸)
        m6 var 사슬 풀기 off    → ❌1  (⑴c)
        m7 `ci < 0` 조기반환 off→ ❌0  ★★안 잡는다 — 아래 「못 재는 것」 ⒥
        m8 길이 표 열쇠 깨뜨림  → ❌2  (⑴ ⑴b)
     ★처음 세운 10칸은 m3·m4 를 ★둘 다 놓쳤다(전부 초록). ⑻⑼는 그래서 ★나중에 붙었다.
       ⛔이 묶음을 줄이려면 ★같은 무력화를 다시 돌려 보고 줄여라.

   ══ 실측 건수 (2026-10-10 · base=v0.9.5 · HEAD=be4ebbc10c77 · tracked dirty 0) ═══
        기본(범위 안)  색 0 · 길이 4  = ★4건     ← 전부 산 코드의 참 적발(눈으로 확인)
        --all(거르개 off) 색 115 · 길이 330 = ★445건
     ⇒ ★범위 거르개가 441건을 걷어낸다. 「범위가 듣는다」의 ★수로 된 증명이다.
     ⛔「색 0건」이 이 자가 장님이라는 뜻이 아니다 — 범위 안 hex 는 주석·토큰 정의·
       var() 대체값을 걷으면 ★#fff / #ccc / #f2f2f2 뿐이고, 그 셋을 가진 ★제안 대상
       토큰이 ★없다(흰색 토큰은 --preset-* 밖에 없다 ⇒ ⒢ 조용히 통과). ★토큰을
       만들면 그날부터 이 자가 그 자리를 잡는다 — 그때까지는 ★안 잡는 것이 맞다.

   ══ ② `--rev <ref>` 와 ★폭발 반경 — ★소비자를 세고 들여라 ══════════════════
   ★이 자는 ★공용 본문이다. 「0건이라 싸다」를 ★내 레인 하나로 말할 수 없다
   (「합쳐라만 말하고 합친 것을 재라를 안 말했다」 ⇒ ★소비자 수만큼 재야 한다).
   ⇒ `--rev <ref>` 로 ★체크아웃 없이(＝★남의 트리 무접촉) 임의 레인을 잰다.
     `git ls-tree`／`git show <ref>:css/x.css` 로 ★블롭을 읽는다. ⛔빈 것을 받으면
     ★0바이트에서 터뜨린다 — 「0건」이 ★「안 봤다」가 되지 않게.
   ★★전수 실측 (2026-10-10 · 레인 233개 중 ＋CSS 인 것 · load 5~8 · 각 98·110초):
       ┌──────────────────┬ base=v0.9.5 ┬ base=v0.9.6 ┐  ← 박았던 값 / 파생되는 값
       │ ＋CSS 레인       │        163  │         70  │
       │ 빨강 레인(지금)  │        147  │         42  │
       │ 적발 합          │       304건 │        71건 │
       │ 서로 다른 자리   │         32  │         24  │
       └──────────────────┴─────────────┴─────────────┘
     ★적발 71건 중 ★47건이 ★같은 두 줄이었다(editor-panels:140 ×38 · editor-props:626 ×9)
       — ★그 둘은 ★이 자가 ★처음 잡아 ★그날 고친 자리다(bdd0ceb6).
     ⇒ ★★그 고침이 dev 에 들어가면: ★빨강 레인 ★42 → ★4 · 적발 ★71 → ★24건
       묶음별 머지 후 — ★gd/* ★0건 · ★taeyang/*·lane-* ★0건 · 나머지 24건
       ★남는 4 레인은 ★전부 ★묵은 가지다: feature/qa-block-admin(20건·09-16) ·
       backup/verhist-* 둘(3건·08-28) · integ7-assembly(1건·10-04).
       (대조 — origin/dev 10-09 · 이 레인 10-10)
     ⇒ ★★결론: ★기준판을 ★파생시키는 것 하나가 ★반경을 147 → 42 로, ★그 위에
       ★네 줄 고침이 42 → 4 로 줄였다. ★★「0건이라 싸다」는 ★이제 ★수로 받쳐진다.
   ⛔위 「머지 후」 수는 ★`file:line` 으로 맞춘 ★추정이다 — 레인마다 줄번호가 다르면
     ★과대/과소가 된다. ★머지한 뒤 ★다시 재라(`--rev` 로 ★한 번에 돈다, 레인 70개 35초).

   ══ 누가 ★부르나 (⛔「만들었다」로 끝나면 이 자는 ★안 돈다) ═════════════════
   ★2026-10-10 실측 — 이 레포에서 ★자동으로 도는 경로는 ★`npm test` ★하나뿐이다:
     · `pre-push` 훅(공유 .git/hooks) — ★`exit 0` 고정. 대시보드 갱신 ★알림만. 못 막는다.
     · CI — `release-mac.yml` / `release-win.yml` 이 ★릴리스 때 `npm test` ＋ `test:dom`.
       (그 워크플로 주석에 「npm test 를 부르는 자리가 훅·CI·배포 어디에도 없었다(T-144)」가
        ★이미 적혀 있다 — 같은 병을 ★두 번 앓지 않기 위해 아래를 둔다.)
   ⇒ ★그래서 `tests/unit/css-token-lint.test.mjs` 가 ★`npm test` 안에서 ★둘을 부른다:
       ⑴ `selfCheck()` 14칸 — ★계측기가 사는지
       ⑵ ★이 CLI 를 ★자식 프로세스로 돌려 ★rc 0 인지 — ★게이트 본체
         ★빨강 메시지에 ★이 자의 stdout 을 그대로 싣는다 ⇒ ★`npm test` 출력만 보고 고칠 수 있다.
   ★★못 재는 판에서는 ★FAIL 이 아니라 ★SKIP 한다(git 없음 · 기준판 태그 안 보임=얕은 checkout).
     ⛔단 ★조용한 통과는 금지 — ★까닭을 stdout 에 박는다(「★안 쟀다(통과가 아니다): …」).
     실측: 기준판을 없는 ref 로 바꿔 돌리면 ★fail 0 · ★skipped 2 ＋ 까닭 두 줄.
     ⇒ ★얕은 CI 에서 ★릴리스를 ★안 막는다. 재게 하려면 `actions/checkout` 에
       ★`fetch-depth: 0` ＋ 태그가 필요하다 — ⛔그 수정은 ★현빈 게이트다(워크플로).

   ══ 쓰는 법 ═══════════════════════════════════════════════════════════════
     npm run gate:css-token                  # 기본 — base 를 안 줘도 돈다(v0.9.5)
     node tools/css-token-lint.mjs --base origin/dev
     node tools/css-token-lint.mjs --all     # 범위 거르개 off (무력화 — 수를 재는 자리)
     node tools/css-token-lint.mjs --census  # 토큰 명부와 «값→토큰» 거꾸로찾기 표
     node tools/css-token-lint.mjs --self    # 양성·음성·범위밖·토큰없음 대조
   종료코드 0 통과 · 1 적발 · 3 HARNESS_ERROR(판정 자체가 성립 안 함)
   ⛔3 을 1 이나 0 으로 접지 마라 — 접는 순간 「자가 고장난 것」이 「깨끗한 것」으로 읽힌다.
═══════════════════════════════════════════════════════════════════════════ */
'use strict';
import fs from 'fs';
import path from 'path';
import cp from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CSS_DIR = 'css';
/* ⛔기준판을 ★문자열로 박지 않는다 — 박으면 그 문자열이 ★둘째 명부가 되고,
 *   ★릴리스가 나는 날 ★조용히 낡는다. 실제로 그 일이 났다(아래 「기준판」). */
const MAIN_REFS = ['origin/main', 'main'];
const TAG_GLOB = 'v[0-9]*';

/* ── 주석·문자열을 «빈칸»으로 — 길이와 줄 구조를 그대로 둔다 ─────────────────
 * ★왜 길이를 보존하나 = 적발 자리를 file:line:col 로 돌려주려면 원본 offset 이
 *   그대로 살아 있어야 한다. 지워 버리면 자리를 잃는다.
 * ★CSS 는 `//` 줄 주석이 없다 — 있는 것처럼 지우면 `url(http://…)` 를 삼킨다.
 * ★tests/unit/_strip-comments.js 를 안 쓴 까닭 = 그 부품은 JS 용이다(템플릿
 *   리터럴·정규식 리터럴 상태를 든다). CSS 엔 그 문법이 없고, 대신 CSS 에만 있는
 *   `url(` 비인용 토큰이 있다. 언어가 다르면 거르개도 다르다. */
export function blankCssNoise(src) {
  /* ★★⛔`Array.from(src)` 로 되돌리지 마라 — 그것은 ★코드포인트 배열이고,
   *   아래 걸음은 `src[i]`·`src.length`(★UTF-16 단위)로 읽는다. ★섞으면 ★서러게이트 쌍
   *   하나당 ★2유닛 어긋나고, 그 뒤 ★빈칸이 ★«밀린 자리»에 찍힌다.
   *   ★2026-10-10 실측: astral 이모지 둘(editor-layout.css:65 `📝` ·
   *   editor-extra.css:1983 `🔗`) 때문에 ★editor-layout.css 는 ★669행까지만 봤다
   *   (선언 479/558 · 790줄 중). ★계약 `blankCssNoise(src).length === src.length` 를
   *   ★검사가 ★전 파일에 걸어 두었다 — 되돌리면 ★그 자리에서 빨개진다. */
  const out = src.split('');          // ★UTF-16 단위 — 아래 색인과 ★같은 단위
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      if (j < 0) j = n; else j += 2;
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' ';
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < n && src[j] !== q) {
        if (src[j] === '\\') j++;
        if (src[j] === '\n') break;       // 안 닫힌 문자열 — 줄에서 끊는다
        j++;
      }
      const end = Math.min(j + 1, n);
      for (let k = i; k < end; k++) if (out[k] !== '\n') out[k] = ' ';
      i = end;
      continue;
    }
    i++;
  }
  return out.join('');
}

/** offset → {line, col} (1-based). 한 파일에 한 번 만들어 재사용한다. */
export function makeLineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (off) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: off - starts[lo] + 1 };
  };
}

/* ── 선언 훑기 ─────────────────────────────────────────────────────────────
 * 주석·문자열이 빈칸이 된 텍스트를 받아, «블록 안»의 선언만 돌려준다.
 * 선택자 텍스트(`{` 앞)는 애초에 안 담는다 — `#canvas` 같은 id 선택자를
 * 색 리터럴로 읽는 사고를 ★구조로 막는다. */
export function scanDeclarations(blanked) {
  const decls = [];
  let depth = 0, i = 0;
  const n = blanked.length;
  let declStart = -1;
  while (i < n) {
    const c = blanked[i];
    if (c === '{') { depth++; declStart = i + 1; i++; continue; }
    if (c === '}') { pushDecl(i); depth = Math.max(0, depth - 1); declStart = i + 1; i++; continue; }
    if (c === ';') { pushDecl(i); declStart = i + 1; i++; continue; }
    if (c === '(') {                        // 괄호 안의 ; 는 선언 끝이 아니다
      const open = i;
      let d = 1; i++;
      while (i < n && d > 0) { if (blanked[i] === '(') d++; else if (blanked[i] === ')') d--; i++; }
      /* ★짝을 못 찾으면 ⛔EOF 까지 먹지 않는다 — 먹으면 ★그 뒤 ★전부를 안 본다.
       * ⇒ ★`(` 다음 한 글자로 돌아가 ★보통 걸음을 잇는다(`;`·`}` 가 다시 경계가 된다).
       * ★이 가드는 ★위 색인 고침과 ★다른 것을 막는다 — ★사람이 쓴 ★진짜 짝 없는 괄호.
       *   ⛔그래서 ★둘 중 하나로 다른 하나를 ★대신하지 마라(실측: 색인만 고치면
       *   editor-layout 은 ★787행까지 보지만, 짝 없는 괄호가 ★새로 들어오면 또 먹는다). */
      if (d > 0) i = open + 1;
      continue;
    }
    i++;
  }
  function pushDecl(end) {
    if (depth < 1 || declStart < 0 || end <= declStart) return;
    const text = blanked.slice(declStart, end);
    const ci = text.indexOf(':');
    if (ci < 0) return;                     // at-rule prelude·중첩 선택자 등
    const prop = text.slice(0, ci).trim();
    if (!prop || /[{}]/.test(prop)) return;
    decls.push({
      prop: prop.toLowerCase(),
      isCustomProp: prop.startsWith('--'),
      valueStart: declStart + ci + 1,
      value: text.slice(ci + 1),
    });
  }
  return decls;
}

/* ── 값에서 «면제 구간»을 빈칸으로 ─────────────────────────────────────────
 * url( … ) 과 var( … ) — ⒞⒟. 괄호 짝을 세며 걷는다. */
export function blankExemptSpans(value) {
  const out = Array.from(value);
  const re = /\b(url|var)\s*\(/gi;
  let m;
  while ((m = re.exec(value))) {
    let i = m.index + m[0].length, d = 1;
    while (i < value.length && d > 0) {
      if (value[i] === '(') d++;
      else if (value[i] === ')') d--;
      i++;
    }
    for (let k = m.index; k < i; k++) if (out[k] !== '\n') out[k] = ' ';
    re.lastIndex = i;
  }
  return out.join('');
}

/* ── 토큰 명부 ─────────────────────────────────────────────────────────────── */
const ROOT_SEL = ':root';

export function collectRootTokens(files, readFile) {
  const defs = [];                     // {name, raw, file, line}
  /* ⛔Set 으로 센다 — 중첩 블록(@media { … })은 바깥 블록 본문에도 같은 선언이
   *   들려 있어, 자리로 안 묶으면 ★같은 줄을 두 번 센다(실측 70 vs 참값 59). */
  const nonRoot = new Set();           // 안 쓰는 것 — 수만 보고한다
  let scopedRoot = 0;                  // ⒜ @media 등 ★안의 :root — 세기만 하고 ★안 쓴다
  for (const f of files) {
    const src = readFile(f);
    const blanked = blankCssNoise(src);
    const at = makeLineIndex(src);
    /* ★블록을 ★깊이와 함께 걷는다 — ⛔indexOf 로 `{` 만 주워 모으면 ★깊이를 잃는다.
     * ★왜 깊이가 필요한가(2026-10-10 적대적 QA ⒊-②) =
     *   `@media (prefers-color-scheme: dark) { :root { --ui-bg-card: #111111 } }`
     *   를 ★진짜 :root 로 세면, last-wins 로 ★다크 값이 표를 덮고
     *   ★라이트에서 쓰는 #ffffff 자리엔 ★거짓음성, ★#111111 자리엔
     *   ★「--ui-bg-card 를 쓰라」는 ★거짓양성이 난다 ⇒ ★따르면 ★검정이 흰색이 된다.
     * ⇒ ★문맥(media query)에 ★딸린 정의는 ★«어느 테마에서 참인지»를 이 자가 모른다.
     *   ★모르면 ★권하지 않는다. */
    const stack = [];                  // 열려 있는 블록의 선택자
    let i = 0;
    const n = blanked.length;
    let segStart = 0;
    while (i < n) {
      const c = blanked[i];
      if (c === '{') {
        const sel = blanked.slice(segStart, i).trim().split('\n').pop().trim();
        stack.push(sel);
        segStart = i + 1;
        /* 이 블록의 본문(중첩 블록 제외)에서 선언을 긁는다 */
        let j = i + 1, d = 1;
        while (j < n && d > 0) { if (blanked[j] === '{') d++; else if (blanked[j] === '}') d--; j++; }
        const body = blanked.slice(i + 1, j - 1).replace(/\{[^{}]*\}/g, '');
        const isRoot = sel === ROOT_SEL;
        const atDepth = stack.length - 1;        // 이 :root 를 감싼 블록 수
        const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]*)/g;
        let m;
        while ((m = re.exec(body))) {
          const rec = { name: m[1], raw: m[2].trim(), file: f, line: at(i + 1 + m.index).line };
          if (isRoot && atDepth === 0) defs.push(rec);
          else if (isRoot) scopedRoot++;         // ⒜ ★@media 안의 :root — 안 쓴다
          else nonRoot.add(`${f}:${rec.line}:${rec.name}`);
        }
        i++;
        continue;
      }
      if (c === '}') { stack.pop(); segStart = i + 1; i++; continue; }
      if (c === ';') { segStart = i + 1; i++; continue; }
      i++;
    }
  }
  return { defs, nonRootCount: nonRoot.size, scopedRootCount: scopedRoot };
}

/* ── ⒝ 이름이 ★중복인데 ★값이 갈리는 토큰 — ★제안표에서 빼라 ───────────────
 * ★「모르면 ★권하지 마라」. 같은 이름이 두 값을 가지면 ★어느 쪽이 그 줄에서
 *   참인지 이 자가 ★모른다(문맥·순서·특이도). ⇒ ★빼는 쪽이 ★틀린 제안보다 낫다.
 * ★같은 값으로 두 번 적힌 것은 ★갈림이 아니다(그대로 둔다). */
export function conflictingNames(defs) {
  const byName = new Map();
  for (const d of defs) {
    if (!byName.has(d.name)) byName.set(d.name, new Set());
    byName.get(d.name).add(d.raw);
  }
  const out = new Set();
  for (const [n, vals] of byName) if (vals.size > 1) out.add(n);
  return out;
}

/** var(--a) 사슬을 리터럴까지 푼다. 같은 이름이 여럿이면 «마지막 정의»가 이긴다(CSS 순서). */
export function resolveTokens(defs) {
  /* ⒝ ★갈리는 이름은 ★여기서 떨군다 — ⛔buildMaps 에 ★인자로 넘기면 ★안 넘긴 호출자가
   *   ★조용히 가드 없이 돈다. ★구조로 잠근다(모든 소비자가 ★자동으로 받는다). */
  const conflict = conflictingNames(defs);
  const raw = new Map();
  for (const d of defs) { if (conflict.has(d.name)) continue; raw.set(d.name, d.raw); }
  const resolved = new Map();
  for (const [name] of raw) {
    let v = raw.get(name);
    for (let step = 0; step < 10; step++) {
      const m = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(v.trim());
      if (!m || !raw.has(m[1])) break;
      v = raw.get(m[1]);
    }
    resolved.set(name, v.trim());
  }
  return resolved;
}

/* ── 제안 대상 패밀리 (머리말 「무엇을 쓰라고 하나」와 ★한 자리) ──────────── */
const SUGGESTABLE = [/^--ui-/, /^--color-/, /^--bg-/, /^--border-/, /^--text-/];
export function isSuggestable(name) { return SUGGESTABLE.some((re) => re.test(name)); }

/** --ui-* 를 먼저. 그 다음은 이름순 — 출력이 판마다 흔들리면 대조가 못 선다. */
function rankTokens(names) {
  return [...names].sort((a, b) => {
    const au = a.startsWith('--ui-') ? 0 : 1, bu = b.startsWith('--ui-') ? 0 : 1;
    return au !== bu ? au - bu : a.localeCompare(b);
  });
}

/* ── hex 정규화 ────────────────────────────────────────────────────────────── */
export function normHex(h) {
  let s = h.slice(1).toLowerCase();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  else if (s.length === 4) s = s.split('').map((c) => c + c).join('');
  if (s.length === 8 && s.endsWith('ff')) s = s.slice(0, 6);
  return '#' + s;
}

/* ── px 토큰 표 — 「토큰 이름이 자기 property 를 말하는 것」만 ─────────────────
 * ⛔여기 없는 px 토큰은 ★일부러 뺀 것이다. 까닭은 머리말 「px 판정 기준」. */
const RADIUS_PROPS = ['border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius'];
const LENGTH_RULES = [
  { match: /^--ui-fs-/, props: ['font-size'] },
  { match: /^--ui-radius-/, props: RADIUS_PROPS },
  { match: /^--ui-row-gap$/, props: ['gap', 'row-gap'] },
];

export function buildMaps(resolved) {
  const color = new Map();                // '#1a1a1a' → [names]
  const length = new Map();               // 'font-size|12px' → [names]
  for (const [name, val] of resolved) {
    if (!isSuggestable(name)) continue;
    const hx = /^#[0-9a-fA-F]{3,8}$/.exec(val.trim());
    if (hx) {
      const k = normHex(val.trim());
      if (!color.has(k)) color.set(k, []);
      color.get(k).push(name);
      continue;
    }
    const px = /^(\d*\.?\d+)px$/.exec(val.trim());
    if (px) {
      for (const rule of LENGTH_RULES) {
        if (!rule.match.test(name)) continue;
        for (const p of rule.props) {
          const k = `${p}|${normPx(px[1])}`;
          if (!length.has(k)) length.set(k, []);
          length.get(k).push(name);
        }
      }
    }
  }
  return { color, length };
}

function normPx(numText) { return String(parseFloat(numText)) + 'px'; }

/* ── 한 파일 훑기 ──────────────────────────────────────────────────────────── */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const PX_RE = /(?<![\w.#-])(\d*\.?\d+)px\b/g;

/**
 * @param {string} src          원본 CSS
 * @param {Set<number>|null} scopeLines  범위 안 줄 번호. null 이면 거르개 off(--all)
 * @param {{color:Map,length:Map}} maps
 * @returns {{file?:string,line:number,col:number,prop:string,literal:string,tokens:string[],kind:'hex'|'px'}[]}
 */
export function lintCss(src, scopeLines, maps) {
  const blanked = blankCssNoise(src);
  const at = makeLineIndex(src);
  const findings = [];
  for (const d of scanDeclarations(blanked)) {
    if (d.isCustomProp) continue;                       // ⒝
    const val = blankExemptSpans(d.value);              // ⒞⒟
    let m;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(val))) {
      const key = normHex(m[0]);
      const names = maps.color.get(key);
      if (!names || !names.length) continue;            // ⒢ 토큰 없음 — 조용히
      push(d, m.index, m[0], names, 'hex');
    }
    PX_RE.lastIndex = 0;
    while ((m = PX_RE.exec(val))) {
      const names = maps.length.get(`${d.prop}|${normPx(m[1])}`);
      if (!names || !names.length) continue;            // ⒢⒣
      push(d, m.index, m[0], names, 'px');
    }
  }
  function push(d, rel, literal, names, kind) {
    const off = d.valueStart + rel;
    const { line, col } = at(off);
    if (scopeLines && !scopeLines.has(line)) return;    // ⒜ ★이 자의 핵심 단언
    findings.push({ line, col, prop: d.prop, literal, tokens: rankTokens(names), kind });
  }
  return findings.sort((a, b) => a.line - b.line || a.col - b.col);
}

/* ── Ⓐ ★거르개 정합 — ⛔「적발 0건」을 ★믿기 전에 ★«본 줄»을 보라 ────────────
 * ★2026-10-10 적대적 QA(advqa)가 ★실명을 찾았고, ★내가 ★뿌리를 다시 쟀다:
 *   css/editor-layout.css (790줄) — ★선언 479개만 보고 ★★669행에서 멈춘다.
 *   css/editor-extra.css (2013줄) — ★선언 1512개(1 모자람).
 * ★★뿌리 = ★`blankCssNoise` 가 `Array.from(src)`(★코드포인트)로 쓰고
 *   `src[i]`·`src.length`(★UTF-16 단위)로 읽는다 ⇒ ★서러게이트 쌍 하나당 ★2유닛 어긋나고,
 *   그 뒤 ★빈칸이 ★밀린 자리에 찍힌다. 두 파일에 ★astral 이모지가 있다
 *   (editor-layout.css:65 `📝` · editor-extra.css:1983 `🔗`).
 *   ★대조(2026-10-10) — astral 문자만 ★같은 UTF-16 길이의 BMP 로 바꾸면:
 *       editor-layout  선언 479 → ★558 · 마지막 본 줄 669 → ★787/790
 *       editor-extra   선언 1512 → ★1513
 *     ★음성대조(무관한 한 글자 변경)는 ★안 변한다 ⇒ astral 이 ★주범이다.
 *   ⛔advqa 가 지목한 ★`:677 $=",0)"` ＋ `:723 base64 url()` 은 ★원인이 ★아니다
 *     — 그 줄만 중화해도 ★479/669 가 ★그대로였다(내 실측). 그 두 줄은 ★드리프트가
 *     ★하필 깨뜨리는 자리일 뿐이다. ★처방을 그 줄에 걸면 ★다음 파일에서 또 난다.
 * ★★지금 ★숨겨진 «진짜 위반» = ★0건 — ★고친 판으로 재 봤다(적발 0→0 · --all 441→441 ·
 *   레인 10벌 전부 동일). ⇒ ★★«오늘 새는 위반»이 아니라 ★«자의 잠복 실명»이다.
 * ⇒ ★그래서 이 절은 ★동작을 ★안 바꾼다. ★재서 ★출력에 ★찍는다.
 *   ★사람이 ★「적발 0건」 옆에서 ★실명을 ★보게 하는 것이 ★구조적 처방이다.
 *
 * ★★Ⓑ (2026-10-10, 이어서) — ★그 실명을 ★고쳤다. ★전/후 ★수:
 *     거르개 정합      ★23/25 → ★25/25 (안 본 자리 0건)
 *     editor-layout    선언 479 · 669행 → ★선언 558 · ★787/790행 · 어긋남 0 · 폭주 0
 *     editor-extra     선언 1512 → ★1513 · 어긋남 0
 *     ★적발 수         기본 ★0 → ★0 · --all ★441 → ★441 (색 115 · 길이 326) ⇒ ★안 바뀐다
 *   ★고침 ★둘 — ⛔하나로 다른 하나를 ★대신하지 마라(막는 것이 ★다르다):
 *     ⒜ `src.split('')` — ★색인 단위를 ★UTF-16 로 맞춘다(★이 실명의 ★뿌리)
 *     ⒝ 짝 없는 `(` 에서 ★EOF 까지 먹지 않고 ★`(` 다음으로 돌아간다
 *        (★사람이 쓴 ★진짜 짝 없는 괄호 — ★색인을 고쳐도 ★그건 남는다)
 *   ★★계약 `blankCssNoise(src).length === src.length` 를 ★검사가 ★전 파일에 걸었다
 *     (tests/unit/css-token-lint.test.mjs · 「Ⓑ 계약 ⑴」) — ⛔`Array.from` 으로 되돌리면
 *     ★그 자리에서 빨개진다. ★무력화 실측: b1(되돌리기) → ★5칸 빨강 · b2(⒝ off) → ★1칸.
 *   ⛔677·723 행은 ★건드리지 않았다 — ★그건 ★결과다(위 반증).
 *
 * ★★★이 자가 ★처음 찾아낸 ★제품 결함 (⛔이 레인에서 ★안 고친다 — 지디 판정):
 *   `css/report-modal.css` 의 ★`var(--ui-fs-11, 11px)` ★8곳.
 *   ★`--ui-fs-11` 은 ★존재하지 않는다(css 0건 · js/html 0건). 참 이름 = `--ui-fs-base: 11px`
 *   (editor-base.css:175). ⇒ 지금은 ★fallback 11px 로 그려지고, `--ui-fs-base` 가
 *   바뀌는 날 ★그 8곳만 ★안 따라간다. ★별건으로 올렸다.
 *   ⛔여기서 고치면 ★이 자가 ★«자기 발견»을 지워 ★다시 증명할 수 없게 된다. */
export function scanIntegrity(src) {
  const blanked = blankCssNoise(src);
  const at = makeLineIndex(src);
  const decls = scanDeclarations(blanked);
  const lines = src.split('\n');
  const totalLines = lines.length;
  const lastSeen = decls.length ? at(decls[decls.length - 1].valueStart).line : 0;
  /* ★자를 «전체 줄»로 잡으면 ★꼬리 빈 줄·`}` 만 있는 파일이 ★거짓양성으로 뜬다
   *   (실측: notice.css 55/57 · pen-tool.css 31/33 — 둘 다 ★멀쩡하다).
   * ⇒ ★«선언이 ★있을 수 있는 마지막 줄»(`;` 가 있는 마지막 줄)로 견준다. */
  let lastCandidate = 0;
  for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].includes(';')) { lastCandidate = i + 1; break; } }
  return {
    decls: decls.length,
    lastSeen,
    totalLines,
    lastCandidate,
    /* ⑴ 거르개 출력 길이가 원본과 다르면 ★색인이 어긋난 것이다(드리프트) */
    lenDrift: blanked.length - src.length,
    /* ⑵ astral(서러게이트 쌍) 수 — 드리프트의 ★원천 */
    astral: Array.from(src).filter((c) => c.codePointAt(0) > 0xFFFF).length,
    /* ⑶ 짝을 못 찾아 끝까지 먹은 `(` 자리 */
    runaway: runawayParens(blanked, at),
  };
}

/** 짝 없는 `(` — 있으면 그 뒤 ★전부를 안 본다. */
export function runawayParens(blanked, at) {
  const out = [];
  let i = 0;
  const n = blanked.length;
  while (i < n) {
    if (blanked[i] === '(') {
      const start = i;
      let d = 1; i++;
      while (i < n && d > 0) { if (blanked[i] === '(') d++; else if (blanked[i] === ')') d--; i++; }
      if (d > 0) out.push(at(start).line);
      continue;
    }
    i++;
  }
  return out;
}

/** 못 본 자리가 있는 파일만 돌려준다. ⛔25파일을 매번 쏟지 않는다(소음이 자를 죽인다). */
export function integrityReport(files, read) {
  const bad = [];
  for (const f of files) {
    const r = scanIntegrity(read(f));
    /* ★`decls > 0` 을 ★같이 거는 까닭 = 블록 ★밖의 at-rule(`@charset "UTF-8";`)도 `;` 를
     *   가져서 lastCandidate 를 올린다. 선언이 ★0인 파일(editor.css = @import 뿐)은
     *   ★멀쩡한데 거짓양성으로 뜬다(실측). ★진짜 전면 실명은 ★lenDrift·runaway 가 잡는다. */
    const blind = r.lenDrift !== 0 || r.runaway.length > 0
      || (r.decls > 0 && r.lastSeen < r.lastCandidate);
    if (blind) bad.push({ file: f, ...r });
  }
  return bad;
}

/* ── 범위 ──────────────────────────────────────────────────────────────────── */
function git(args, opts = {}) {
  const r = cp.spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) harness(`git 실행 실패: ${r.error.message}`);
  return r;
}

function harness(msg) {
  process.stderr.write(`HARNESS_ERROR  ${msg}\n`);
  process.exit(3);
}

/* ── ① 기준판을 ★파생시킨다 ────────────────────────────────────────────────
 * ★「명부가 둘이면 경고 주석으로 못 막는다 — 파생시켜 하나로」.
 *   둘째 명부였던 것 = `DEFAULT_BASE = 'v0.9.5'` ★그 문자열. ★실제로 낡았다:
 *   2026-10-10 실측 — origin/main = 9de05e189791 = ★v0.9.6 ★그 자체(GitHub 릴리스
 *   0.9.6 Latest · package.json 0.9.6). ★그런데 박아 둔 값은 ★v0.9.5 였다.
 * ★★«두 길»로 구해 ★견준다 — 한 길만 쓰면 그 길이 틀렸을 때 ★모른다:
 *   ⒜ `describe --abbrev=0`      — 역사 거리로 ★가장 가까운 태그
 *   ⒝ `tag --merged --sort=-v:refname` — 머지된 것 중 ★가장 높은 판번호
 *   ⛔둘이 갈리면 ★고르지 않는다 — {ok:false} 로 돌려 ★사람이 보게 한다
 *     (갈리는 판 = hotfix 태그가 가지에 달렸거나, main 이 태그를 지나쳐 갔을 때)
 * ⛔못 뽑으면 ★박아둔 값으로 ★폴백하지 않는다 — 폴백하면 ★「기준판이 낡았다」가
 *   ★영영 안 보인다. CLI 는 ★HARNESS_ERROR(3), 검사는 ★SKIP(까닭 찍고)으로 간다. */
export function deriveBase(gitFn) {
  const g = gitFn || ((...a) => git(a));
  let mainRef = null;
  for (const r of MAIN_REFS) {
    const v = g('rev-parse', '--verify', '--quiet', `${r}^{commit}`);
    if (v.status === 0 && v.stdout.trim()) { mainRef = r; break; }
  }
  if (!mainRef) {
    return { ok: false, reason: `main 줄기를 못 찾는다 (${MAIN_REFS.join(' · ')} 전부 안 보인다) — 얕은 checkout 이면 원격 가지가 없다` };
  }
  const a = g('describe', '--tags', '--abbrev=0', '--match', TAG_GLOB, mainRef);
  const b = g('tag', '--list', TAG_GLOB, '--merged', mainRef, '--sort=-v:refname');
  const viaDescribe = a.status === 0 ? a.stdout.trim() : '';
  const viaSort = b.status === 0 ? (b.stdout.trim().split('\n')[0] || '') : '';
  if (!viaDescribe && !viaSort) {
    return { ok: false, reason: `${mainRef} 에 '${TAG_GLOB}' 태그가 0건 — 얕은 checkout 은 태그를 안 받는다(fetch-depth: 0 ＋ tags 필요)` };
  }
  if (viaDescribe !== viaSort) {
    return { ok: false, reason: `두 길이 갈린다 — describe=${viaDescribe || '(없다)'} · 판번호순=${viaSort || '(없다)'} ⇒ ⛔골라 쓰지 않는다. 사람이 보라` };
  }
  return { ok: true, base: viaDescribe, mainRef, how: `${mainRef} 의 최신 릴리스 태그(describe ＝ 판번호순 ★두 길 일치)` };
}

/* ── ② `--rev <ref>` — ★체크아웃 없이 ★임의 레인을 잰다 ─────────────────────
 * ★왜 = 이 게이트는 ★공용 본문이다. 「0건이라 싸다」를 ★내 레인 하나로 말할 수 없다.
 *   레인마다 재려면 ★체크아웃이 필요한데, 그건 ★남의 트리를 건드리는 일이다.
 *   ⇒ `git show <ref>:css/x.css` 로 ★블롭을 읽어 ★무접촉으로 잰다.
 * ⛔`git show` 가 ★조용히 빈 것을 주면 ★「0건」이 ★거짓이 된다 ⇒ ★rc 와 ★길이를 ★같이 본다. */
function refSource(rev) {
  const ls = git(['ls-tree', '-r', '--name-only', rev, '--', `${CSS_DIR}/`]);
  if (ls.status !== 0) harness(`ref '${rev}' 의 ${CSS_DIR}/ 를 못 읽는다: ${(ls.stderr || '').trim()}`);
  const files = ls.stdout.split('\n').filter((f) => f.endsWith('.css')).sort();
  if (!files.length) harness(`ref '${rev}' 에 ${CSS_DIR}/*.css 가 0개다 — 자가 ★빈 자리를 재고 있다`);
  const cache = new Map();
  return {
    label: `ref ${rev}`,
    files: () => files,
    read: (rel) => {
      if (cache.has(rel)) return cache.get(rel);
      const r = git(['show', `${rev}:${rel}`]);
      if (r.status !== 0) harness(`git show ${rev}:${rel} 가 ${r.status} 로 죽었다: ${(r.stderr || '').trim()}`);
      if (!r.stdout.length) harness(`${rev}:${rel} 이 ★0바이트다 — ⛔「0건」으로 접지 마라(빈 것을 받은 것이다)`);
      cache.set(rel, r.stdout);
      return r.stdout;
    },
  };
}

function treeSource() {
  const dir = path.join(ROOT, CSS_DIR);
  if (!fs.existsSync(dir)) harness(`${CSS_DIR}/ 가 없다`);
  const list = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort().map((f) => `${CSS_DIR}/${f}`);
  if (!list.length) harness(`${CSS_DIR}/*.css 가 0개다 — 자가 빈 자리를 재고 있다`);
  return { label: '작업트리', files: () => list, read: (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8') };
}

/** base 를 merge-base 로 바꿔 돌려준다. ⛔두-점 diff 는 양방향이라 쓰지 않는다. */
export function resolveBase(baseRef, rev) {
  const tip = rev || 'HEAD';
  const a = git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
  if (a.status !== 0 || !a.stdout.trim()) harness(`기준판 '${baseRef}' 를 못 찾는다`);
  const mb = git(['merge-base', baseRef, tip]);
  if (mb.status !== 0 || !mb.stdout.trim()) harness(`merge-base(${baseRef}, ${tip}) 가 없다`);
  return { baseSha: a.stdout.trim(), mergeBase: mb.stdout.trim() };
}

/** 직전 릴리스 태그 — ★창이 릴리스마다 «좁아지는» 것을 ★수로 보이게 하려고 쓴다. */
function prevReleaseTag(baseRef, mainRef) {
  const b = git(['tag', '--list', TAG_GLOB, '--merged', mainRef, '--sort=-v:refname']);
  if (b.status !== 0) return null;
  const tags = b.stdout.trim().split('\n').filter(Boolean);
  const i = tags.indexOf(baseRef);
  return (i >= 0 && tags[i + 1]) ? tags[i + 1] : null;
}

/** file → Set(새 줄 번호). `git diff -U0 <mergeBase> -- css/*.css` 의 `+` 줄. */
export function scopeLinesFromDiff(mergeBase, rev) {
  /* rev 를 주면 ★그 ref 의 트리와 견준다(⛔체크아웃 없이) · 안 주면 ★작업트리 */
  const args = ['diff', '-U0', '--no-color', '--no-ext-diff', mergeBase];
  if (rev) args.push(rev);
  args.push('--', `${CSS_DIR}/*.css`);
  const r = git(args);
  if (r.status !== 0) harness(`git diff 가 ${r.status} 로 죽었다: ${(r.stderr || '').trim()}`);
  const map = new Map();
  let file = null, ln = 0;
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('+++ b/')) { file = line.slice(6).trim(); if (!map.has(file)) map.set(file, new Set()); continue; }
    if (line.startsWith('+++ ')) { file = null; continue; }
    if (line.startsWith('@@')) {
      const m = /\+(\d+)/.exec(line);
      if (!m) harness(`hunk 머리를 못 읽는다: ${line}`);
      ln = parseInt(m[1], 10);
      continue;
    }
    if (line.startsWith('+')) { if (file) map.get(file).add(ln); ln++; continue; }
    if (line.startsWith('-') || line.startsWith('\\')) continue;
    if (line.startsWith(' ')) ln++;
  }
  return map;
}


/* ── 양성·음성·범위밖·토큰없음 대조 ────────────────────────────────────────
 * ⛔합성 표본이다 — 「레포에 이런 꼴이 있어야 한다」를 전제로 걸지 않는다.
 *   그렇게 걸면 그 꼴을 고쳐 없앨수록 이 자가 빨개진다.
 * ★표본의 토큰 값은 ★레포의 산 토큰에서 끌어온다 — 손으로 박으면 토큰 값이
 *   바뀐 날 이 대조가 «조용히» 아무것도 안 재게 된다. */
export function selfCheck(maps, resolved) {
  const results = [];
  const bgInput = resolved.get('--ui-bg-input');          // #2a2a2a
  const radiusSm = resolved.get('--ui-radius-sm');        // 4px
  const fs12 = resolved.get('--ui-fs-12');                // 12px
  const localOnly = resolved.get('--goya-checker-big-a'); // #d8d8d8 — ★제안 «대상이 아닌» 패밀리
  if (!bgInput || !radiusSm || !fs12 || !localOnly) {
    return [{ name: '전제: 표본이 쓸 토큰이 레포에 있나', ok: false,
      note: `--ui-bg-input=${bgInput} --ui-radius-sm=${radiusSm} --ui-fs-12=${fs12} --goya-checker-big-a=${localOnly}`
          + ' — 하나라도 없으면 아래 대조는 0건짜리 거짓이다' }];
  }
  results.push({ name: '전제: 표본이 쓸 토큰 4종이 명부에 있다', ok: true,
    note: `--ui-bg-input=${bgInput} · --ui-radius-sm=${radiusSm} · --ui-fs-12=${fs12} · --goya-checker-big-a=${localOnly}` });
  /* ★전제 ② — ⑻이 «항등식»이 아님을 걸어 둔다. localOnly 의 값을 ★제안 대상 토큰이
   *   같이 갖고 있으면 ⑻은 무엇을 끄든 초록이라 아무것도 안 잠근다. */
  results.push({ name: '전제: ⑻의 표본값이 «제안 대상 표»에 없다 (없어야 ⑻이 뭔가를 잠근다)',
    ok: !maps.color.has(normHex(localOnly)),
    note: `${normHex(localOnly)} → 제안표 ${maps.color.has(normHex(localOnly)) ? '있다(⛔⑻ 무효)' : '없다'}` });

  const SAMPLE = [
    /* 1 */ '.a { background: ' + bgInput + '; }',
    /* 2 */ '.b { border-radius: ' + radiusSm + '; }',
    /* 3 */ '.c { font-size: ' + fs12 + '; }',
    /* 4 */ '.d { background: var(--ui-bg-input); border-radius: var(--ui-radius-sm); }',
    /* 5 */ '.e { background: #ff00ff; font-size: 37px; }',
    /* 6 */ '.f { background: ' + bgInput + '; }',
    /* 7 */ '--z: ' + bgInput + ';',
    /* 8 */ '.g { color: var(--nope, ' + bgInput + '); }',
    /* 9 */ '.h { background: url("data:image/svg+xml,%3Csvg fill=\'' + bgInput + '\'/%3E"); }',
    /* 10*/ '/* 주석 안: background: ' + bgInput + ' 와 border-radius: ' + radiusSm + ' */',
    /* 11*/ '#canvas .i { padding: 0; }',
    /* 12*/ '.j { padding: ' + radiusSm + '; height: 24px; }',
    /* 13*/ '.k { /* background: ' + bgInput + '; */ color: var(--ui-text); }',
    /* 14*/ '.l { background: ' + localOnly + '; }',
  ].join('\n');
  // 7행은 블록 밖이라 그대로 두면 선언으로 안 잡힌다 — :root 안에 넣어 ⒝를 제대로 재게 한다
  const SRC = SAMPLE.replace('--z: ' + bgInput + ';', ':root { --z: ' + bgInput + '; }');

  const inScope = new Set([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14]);   // 6행만 범위 밖
  const got = lintCss(SRC, inScope, maps);
  const key = (f) => `${f.line}:${f.prop}:${f.literal}`;
  const keys = got.map(key);

  const want = ['1:background:' + bgInput, '2:border-radius:' + radiusSm, '3:font-size:' + fs12];
  results.push({ name: '⑴ 양성 — 토큰 있는 하드코딩 3건을 범위 안에서 잡는가', ok: JSON.stringify(keys) === JSON.stringify(want),
    note: `잡은 것 ${keys.length}건 [${keys.join(' , ')}] / 기대 [${want.join(' , ')}]` });

  const msgs = got.map((f) => renderFinding('sample.css', f));
  results.push({ name: '⑴b 양성 — 문구에 «우리 토큰 이름»이 나오나', ok: msgs.length === 3
      && msgs[0].includes('var(--ui-bg-input)') && msgs[1].includes('var(--ui-radius-sm)') && msgs[2].includes('var(--ui-fs-12)'),
    note: msgs.join(' | ') || '(출력 0건 — 위 ⑴이 깨졌으면 이 칸은 못 잰다)' });

  /* ★var(--a) 사슬 풀기를 재는 자리 — --bg-input 은 `var(--p-gray-700)` 이라
   *   사슬을 안 풀면 이 이름이 ★문구에 못 나온다(그러면 semantic 층을 못 권한다). */
  results.push({ name: '⑴c 양성 — var() 사슬로만 닿는 토큰(--bg-input → --p-gray-700)도 문구에 나오나',
    ok: msgs.length > 0 && msgs[0].includes('var(--bg-input)'),
    note: `--bg-input 원값=${(resolved.get('--bg-input') || '(없다)')} / 1번 문구=${msgs[0] || '(없다)'}` });

  results.push({ name: '⑵ 음성 — 이미 var(--x) 를 쓰는 줄(4행)은 안 잡는가', ok: !keys.some((k) => k.startsWith('4:')),
    note: `4행 적발 ${keys.filter((k) => k.startsWith('4:')).length}건` });

  results.push({ name: '⑶ 범위밖 — 같은 하드코딩(6행)을 범위 밖에 두면 안 잡는가 ★핵심', ok: !keys.some((k) => k.startsWith('6:')),
    note: `6행 적발 ${keys.filter((k) => k.startsWith('6:')).length}건 (내용은 1행과 한 글자도 안 다르다)` });

  const all = lintCss(SRC, null, maps).map(key);
  results.push({ name: '⑶b 범위밖 — 거르개를 «끄면» 그 6행이 ★나타나나 (음성대조가 죽은 자가 아님을 증명)', ok: all.some((k) => k.startsWith('6:')),
    note: `--all 적발 ${all.length}건 [${all.join(' , ')}]` });

  results.push({ name: '⑷ 토큰없음 — #ff00ff·37px(5행)은 조용히 지나가나', ok: !keys.some((k) => k.startsWith('5:')),
    note: `5행 적발 ${keys.filter((k) => k.startsWith('5:')).length}건` });

  results.push({ name: '⑸ 면제 — 토큰 정의(:root --z)·var() 대체값(8행)·url()(9행)을 안 잡는가',
    ok: !keys.some((k) => /^(7|8|9):/.test(k)) && !all.some((k) => /^(7|8|9):/.test(k)),
    note: `해당 줄 적발 ${all.filter((k) => /^(7|8|9):/.test(k)).length}건(거르개 off 기준)` });

  results.push({ name: '⑹ property 가 안 맞으면 안 잡는가 — padding: 4px · height: 24px(12행)', ok: !all.some((k) => k.startsWith('12:')),
    note: `12행 적발 ${all.filter((k) => k.startsWith('12:')).length}건 (4px 는 radius·gap 에서만, 24px 는 표에 없다)` });

  results.push({ name: '⑺ id 선택자 #canvas(11행)를 색으로 읽지 않는가', ok: !all.some((k) => k.startsWith('11:')),
    note: `11행 적발 ${all.filter((k) => k.startsWith('11:')).length}건` });

  /* ⑻⑼는 ★나중에 붙였다 — 처음 10칸은 ★무력화 대조에서 ★둘을 놓쳤다(2026-10-10):
   *   m3 「제안 패밀리 거르개 off」·m4 「주석 벗기기 off」가 ★10칸 전부 초록이었다.
   *   ⇒ 「대조를 세웠다」가 아니라 「무력화해 보니 빨개진다」만 근거다. */
  results.push({ name: '⑻ 제안 «대상 아닌» 패밀리뿐인 값(--goya-checker-big-a, 14행)은 안 잡는가',
    ok: !all.some((k) => k.startsWith('14:')),
    note: `14행 적발 ${all.filter((k) => k.startsWith('14:')).length}건 — 지역 전용 토큰을 「이걸 쓰라」고 권하면 틀린다` });

  /* ⛔10행(블록 «밖»의 주석)은 ★주석 거르개가 아니라 ★depth 가 막는다 — 죽은 대조다.
   *   13행은 ★선언 자리의 «블록 안» 주석이라, 거르개를 끄면 ★반드시 빨개진다. */
  results.push({ name: '⑼ 블록 «안» 주석에 든 하드코딩(13행)을 안 잡는가 — ★주석 거르개를 재는 자리',
    ok: !all.some((k) => k.startsWith('13:')),
    note: `13행 적발 ${all.filter((k) => k.startsWith('13:')).length}건 / 블록 밖 주석(10행) ${all.filter((k) => k.startsWith('10:')).length}건` });

  /* ⑽⑾ ★문맥 축 — 2026-10-10 적대적 QA(advqa) ⒊-② 가 열었다.
   *   ⛔산 레포의 maps 로는 못 잰다(지금 ★0건이라 ★항등식이 된다) ⇒ ★합성 명부로 잰다.
   *   ★그리고 ★양성·음성을 ★한 쌍으로 — 「안 권한다」만 재면 ★죽은 자가 된다. */
  const DARK = ':root { --ui-bg-card: #ffffff; }\n'
    + '@media (prefers-color-scheme: dark) { :root { --ui-bg-card: #111111; } }\n';
  const dc = collectRootTokens(['syn.css'], () => DARK);
  const dres = resolveTokens(dc.defs);
  const dmaps = buildMaps(dres);
  const dgot = lintCss('.light-only{background:#111111}\n.a{background:#ffffff}\n', null, dmaps)
    .map((f) => `${f.line}:${f.literal}`);
  results.push({ name: '⑽ 문맥 — @media 안의 :root 를 ★제안표에 안 넣는다 (★검정에 흰 토큰을 권하지 않는다)',
    ok: dc.defs.length === 1 && dc.scopedRootCount === 1 && dres.get('--ui-bg-card') === '#ffffff'
        && !dgot.includes('1:#111111') && dgot.includes('2:#ffffff'),
    note: `깊이0 :root ${dc.defs.length}건 · @media 안 ${dc.scopedRootCount}건 · --ui-bg-card=${dres.get('--ui-bg-card')}`
        + ` · 적발 [${dgot.join(' , ')}]  (기대: 2:#ffffff 만 — 1행을 잡으면 ★라이트에서 검정이 흰색이 된다)` });

  const CONF = ':root{--x-dup:#111111}\n:root{--x-dup:#222222}\n:root{--ui-bg-card:#2a2a2a}\n';
  const cc = collectRootTokens(['syn2.css'], () => CONF);
  const conf = conflictingNames(cc.defs);
  const cres = resolveTokens(cc.defs);
  const cmaps = buildMaps(cres);
  results.push({ name: '⑾ 문맥 — 이름이 ★중복인데 ★값이 갈리면 ★제안표에서 뺀다 (★모르면 권하지 마라)',
    ok: conf.has('--x-dup') && !cres.has('--x-dup') && !cmaps.color.has('#111111') && !cmaps.color.has('#222222')
        && cres.get('--ui-bg-card') === '#2a2a2a' && cmaps.color.has('#2a2a2a'),
    note: `갈리는 이름 [${[...conf].join(',')}] · resolved 에 --x-dup ${cres.has('--x-dup') ? '⛔있다' : '없다'}`
        + ` · 갈리지 않는 --ui-bg-card 는 ★남는다(${cres.get('--ui-bg-card')})` });

  return results;
}

/* ── 출력 ──────────────────────────────────────────────────────────────────── */
export function renderFinding(file, f) {
  const use = f.tokens.map((t) => `var(${t})`).join(' 또는 ');
  const what = f.kind === 'hex' ? '하드코딩 색' : '하드코딩 길이';
  return `${file}:${f.line}:${f.col}  ${what} \`${f.prop}: ${f.literal}\`  ⇒ ★${use} 를 쓰라`;
}

/* ── main ──────────────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const o = { base: null, baseFrom: null, rev: null, all: false, census: false, self: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') o.all = true;
    else if (a === '--census') o.census = true;
    else if (a === '--self') o.self = true;
    else if (a === '--base') { o.base = argv[++i]; if (!o.base) harness('--base 뒤에 값이 없다'); o.baseFrom = '--base 로 ★손으로 줬다'; }
    else if (a.startsWith('--base=')) { o.base = a.slice(7); o.baseFrom = '--base 로 ★손으로 줬다'; }
    else if (a === '--rev') { o.rev = argv[++i]; if (!o.rev) harness('--rev 뒤에 값이 없다'); }
    else if (a.startsWith('--rev=')) o.rev = a.slice(6);
    else if (a === '-h' || a === '--help') { process.stdout.write(HELP); process.exit(0); }
    else harness(`모르는 인자: ${a}`);
  }
  return o;
}

const HELP = `css-token-lint — 바뀐 CSS 줄의 하드코딩 hex/px 를, «토큰이 있을 때만» 잡는다.
  node tools/css-token-lint.mjs [--base <ref>] [--rev <ref>] [--all] [--census] [--self]
  ★기준판은 ⛔박혀 있지 않다 — origin/main 의 ★최신 릴리스 태그에서 ★파생한다.
    못 뽑으면 ★HARNESS_ERROR(3). ⛔박아둔 값으로 ★조용히 폴백하지 않는다.
  --rev <ref>  ★체크아웃 없이 ★그 ref 를 잰다(남의 레인 ★무접촉 측정).
`;

function main() {
  const opt = parseArgs(process.argv.slice(2));

  /* ── ① 기준판 — ★파생이 먼저, ★--base 는 override 이고 ★출력에 박는다 ── */
  let baseRef = opt.base, baseHow = opt.baseFrom, mainRef = null;
  if (!baseRef && !opt.all) {
    const d = deriveBase();
    if (!d.ok) harness(`기준판을 못 뽑는다 — ${d.reason}\n`
      + '              ⛔박아둔 값으로 폴백하지 않는다(폴백하면 「기준판이 낡았다」가 영영 안 보인다).\n'
      + '              ⇒ 태그까지 받아라: actions/checkout 은 fetch-depth: 0 ＋ tags 필요.');
    baseRef = d.base; baseHow = d.how; mainRef = d.mainRef;
  }

  const src = opt.rev ? refSource(opt.rev) : treeSource();
  const files = src.files();
  const { defs, nonRootCount, scopedRootCount } = collectRootTokens(files, src.read);
  if (defs.length === 0) harness(`:root 토큰 정의가 0건 (${src.label}) — 명부가 비면 이 자는 아무것도 못 잰다`);
  const resolved = resolveTokens(defs);
  const maps = buildMaps(resolved);
  if (maps.color.size === 0) harness('«값→토큰» 색 표가 비었다 — 자가 장님이다');

  if (opt.census) {
    process.stdout.write(`토큰 정의 — :root ${defs.length}건 (${src.label} · 파일 ${files.length}개) · :root 아닌 자리 ${nonRootCount}건(안 쓴다)`
      + ` · @media 등 ★안의 :root ${scopedRootCount}건(★문맥을 몰라 안 쓴다)\n`);
    process.stdout.write(`제안 대상 패밀리로 걸러진 표 — 색 ${maps.color.size}값 · 길이 ${maps.length.size}짝\n\n`);
    process.stdout.write('── 값 → 토큰 (색) ──\n');
    for (const k of [...maps.color.keys()].sort()) process.stdout.write(`  ${k}  →  ${rankTokens(maps.color.get(k)).join(' , ')}\n`);
    process.stdout.write('\n── (property, 값) → 토큰 (길이) ──\n');
    for (const k of [...maps.length.keys()].sort()) process.stdout.write(`  ${k.padEnd(34)}  →  ${rankTokens(maps.length.get(k)).join(' , ')}\n`);
    process.exit(0);
  }

  if (opt.self) {
    const rows = selfCheck(maps, resolved);
    let bad = 0;
    for (const r of rows) { if (!r.ok) bad++; process.stdout.write(`${r.ok ? '✅' : '❌'} ${r.name}\n     ${r.note}\n`); }
    process.stdout.write(`\n대조 ${rows.length}칸 중 ${rows.length - bad} 통과 · ${bad} 실패\n`);
    if (bad) { process.stderr.write('HARNESS_ERROR  자기대조가 깨졌다 — 이 자의 적발/통과를 믿을 수 없다\n'); process.exit(3); }
    process.exit(0);
  }

  let scope = null, lines = 0, head = '(범위 거르개 off — --all)';
  if (!opt.all) {
    const { baseSha, mergeBase } = resolveBase(baseRef, opt.rev);
    scope = scopeLinesFromDiff(mergeBase, opt.rev);
    lines = [...scope.values()].reduce((a, v) => a + v.size, 0);
    head = `base=${baseRef} ${baseSha.slice(0, 12)} (${baseHow}) · 잰 것=${opt.rev || 'HEAD/작업트리'}`
         + ` · merge-base ${mergeBase.slice(0, 12)} · 범위 ${scope.size}파일 ${lines}줄`;
    /* ★★창이 ★릴리스마다 ★좁아진다 — ⛔조용히 좁아지면 「조용히 낮아진 기준선」이 된다.
     *   ⇒ ★직전 태그 기준 범위를 ★같이 찍어 ★그 좁아짐을 ★수로 보인다. */
    if (mainRef) {
      const prev = prevReleaseTag(baseRef, mainRef);
      if (prev) {
        const pm = git(['merge-base', prev, opt.rev || 'HEAD']);
        if (pm.status === 0 && pm.stdout.trim()) {
          const ps = scopeLinesFromDiff(pm.stdout.trim(), opt.rev);
          const pl = [...ps.values()].reduce((a, v) => a + v.size, 0);
          head += `\n⚠️창은 릴리스마다 ★좁아진다 — 직전 태그 ${prev} 기준 ${pl}줄 → 지금 ${lines}줄 (${lines - pl}줄)`;
        }
      }
    }
    if (lines === 0) {
      process.stdout.write(`css-token-lint — ${head}\n범위 안 CSS 줄이 0줄이다.\n`);
      process.stdout.write('⇒ 0건은 「깨끗하다」가 아니라 「볼 것이 없다」다.\n');
      process.exit(0);
    }
  }

  const all = [];
  for (const f of files) {
    const ls = opt.all ? null : (scope.get(f) || new Set());
    if (ls && ls.size === 0) continue;
    for (const fd of lintCss(src.read(f), ls, maps)) all.push({ file: f, ...fd });
  }

  process.stdout.write(`css-token-lint — ${head}\n`);
  const dropped = conflictingNames(defs);
  process.stdout.write(`토큰 명부 :root ${defs.length}건 → 제안 표 색 ${maps.color.size}값 · 길이 ${maps.length.size}짝`
    + (scopedRootCount ? ` · ⚠️@media 안 :root ${scopedRootCount}건은 ★안 쓴다(문맥 모름)` : '')
    + (dropped.size ? ` · ⚠️값이 갈려 ★뺀 토큰 ${dropped.size}종 [${[...dropped].join(',')}]` : '') + '\n');

  /* ── Ⓐ ★거르개 정합 — ⛔「적발 0건」 옆에 ★«안 본 자리»를 같이 찍는다 ──────── */
  const bad = integrityReport(files, src.read);
  if (!bad.length) {
    process.stdout.write(`거르개 정합 ${files.length}/${files.length} — ★안 본 자리 0건\n`);
  } else {
    process.stdout.write(`⛔거르개 정합 ${files.length - bad.length}/${files.length} — ★${bad.length}파일에서 ★«그 뒤를 안 본다»:\n`);
    for (const b of bad) {
      process.stdout.write(`   ${b.file}  선언 ${b.decls}개 · ★마지막 본 줄 ${b.lastSeen}`
        + ` (선언 가능한 마지막 ${b.lastCandidate} / 전체 ${b.totalLines})`
        + (b.lenDrift ? ` · ★색인 어긋남 ${b.lenDrift} (astral ${b.astral}자)` : '')
        + (b.runaway.length ? ` · 짝 없는 ( ${b.runaway.join(',')}행` : '') + '\n');
    }
    process.stdout.write('   ⇒ ★그 구간의 하드코딩은 ★조용히 ★rc 0 으로 통과한다.'
      + ' ⛔「범위 안 하드코딩 0건」을 ★참으로 읽지 마라.\n');
  }

  if (!all.length) {
    process.stdout.write('적발 0건.\n');
    process.stdout.write('⛔「이 레포에 하드코딩이 없다」가 아니다 — 이 자는 ⑴범위 안 ⑵토큰이 있는 자리만 본다(머리말 「무엇을 안 재나」).\n');
    process.exit(0);
  }
  for (const f of all) process.stdout.write(renderFinding(f.file, f) + '\n');
  const hex = all.filter((f) => f.kind === 'hex').length;
  process.stdout.write(`\n적발 ${all.length}건 — 색 ${hex} · 길이 ${all.length - hex}\n`);
  if (opt.all) {
    process.stdout.write('⛔이 수는 「고쳐야 할 결함」이 아니다 — ★범위 밖까지 센 수다(--all). 판정에 쓰지 마라.\n');
  }
  process.stdout.write('⇒ npm run gate:css-token   (자리를 다시 보려면)\n');
  process.stdout.write('고치는 법: 위 문구의 `var(--…)` 로 그 리터럴을 ★그 자리에서 바꿔라. 토큰이 여럿이면 그 줄의 뜻에 맞는 것을 골라라.\n');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
