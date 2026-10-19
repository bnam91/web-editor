/* annot-label-rich-text-1017t1h3 — 어노테이션 라벨의 «부분 서식»(고른 글자만 색·폰트크기).
 *
 * ★요구(현빈 1017t1h3 원문): 「라벨의 텍스트인 경우 선택한 영역만 색지정 혹은 폰트크기 등 각 다르게
 *   입력할수 있게해줘. 일반 텍스트 블럭 처럼 말야.」
 *
 * ★★★이 파일은 ★«아직 안 돌렸다»(2026-10-19 · DOM 0 지시 — 맥 메모리 바닥, swap 95%+).
 *   ⛔그러니 ★이 파일의 존재를 ★「행동을 쟀다」로 ★읽지 마라. 1013t2C6 도 ★같은 꼴로 써 두고
 *   ★안 돌렸다(그 커밋 메시지에 그렇게 적혀 있다) — ★그 선례를 따르되 ★그 사실을 ★여기 박는다.
 *   ★돌릴 사람이 ★먼저 볼 것: ★아래 ⑴~⑺ 은 ★1017t1h3 이 ★9334 개발판(실 DOM · 읽기 전용)에서
 *   ★모듈을 직접 import 해 ★손으로 ★재서 ★17/17 초록을 받은 축들이다. ★여기선 ★«사람이 하는 순서»
 *   (고르기 → 끌어 선택 → 패널 누르기 → 저장 → 리로드)로 ★다시 재는 것이 ★일이다.
 *
 * ★무엇을 잠그나
 *   RL1 ⌘B — 라벨 글 일부를 끌어 고르고 ⌘B → 그 글자만 굵다 · 커밋 뒤 dataset.labelHtml 에 <b> · text 는 평문 그대로
 *   RL2 패널 크기 — 일부를 고르고 「라벨 › 크기」를 바꾸면 ★그 글자만 px 이 바뀐다(라벨 전체 font-size 는 ★안 바뀐다)
 *   RL3 패널 색 — 같은 손짓으로 색도 «고른 글자만» (그 자리가 _annotApplyToSelection)
 *   RL4 ★연달아 둘 — 크기 바꾼 ★직후 색도 바꾸면 ★같은 글자에 간다(저장 선택을 버리지 않는다 · TX1 증상)
 *   RL5 선택 ★없이 패널을 만지면 ★라벨 전체다 — ★옛 동작 무변(「편집 밖에서 바꾼 값은 블럭 전체」)
 *   RL6 ★저장 왕복(직렬화 → rebindAll) · ⌘Z 복원 뒤에도 부분 서식이 ★그대로
 *   RL7 ★서식을 전부 지우면(⌘B 두 번) dataset.labelHtml ★키가 사라진다 = 옛 저장본과 같은 꼴
 *   RL8 ★줄 수 — 서식 든 줄에 Enter 를 넣어도 text 의 \n 수와 화면 줄 수가 ★같다(line-host LR8 과 같은 함정)
 *   RL9 ★1013t2C6 무회귀 — `<b>x</b>` 를 ★타이핑하면 ★글자로 남는다(b 요소 0) · 다시 그려도 그대로
 *   RL10 ★변조 저장본 — dataset.labelHtml 에 `<img src=x onerror>` 를 손으로 넣고 rebindAll → ★img 0 · 안 돈다
 *   RL11 ★내보내기(export-html) 산출에 ★인라인 span 이 실린다(앱 CSS 를 안 싣는 길이라 style 로 나가야 한다)
 *   RL12 ★image 모드로 갔다 오면 ★서식이 안 되살아난다(「반대편 데이터 폐기」 규약)
 *
 * ★★돌릴 때 ★먼저 세울 것(양성대조) — ⛔초록만 보고 닫지 마라
 *   ㉠ `window.ANNOT_RICH_TEXT_OPTS.styleProps` 를 `[]` 로 바꾼 판에서 ★RL2 가 ★빨개지는가
 *   ㉡ `annotation-select.js` 의 `nextHtml` 쓰기를 끊은 판에서 ★RL1·RL6 이 ★빨개지는가
 *   ㉢ `RETAIN_ON_PANEL_BLUR_SEL` 에서 `.annot-label` 을 뺀 판에서 ★RL2·RL3·RL4 가 ★빨개지는가
 *     (★단위 검사는 ★이 셋을 ★«소스 앵커»로만 잡는다 — ★행동은 ★여기가 임자다)
 *   ★바닥이 «고정 대기»면 첫 빨강이 ★운일 수 있다 ⇒ ★각 양성대조는 ★×3.
 * ⛔waitForTimeout 0 — 모든 대기는 «재는 값» 자체를 expect.poll 로 기다린다(annotation-1013t2 와 같은 규율).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';

test.describe('annot-label-rich-text-1017t1h3', () => {
  test.skip(true, '★1017t1h3 — 아직 안 돌렸다(DOM 0 지시 · 맥 메모리 바닥). '
    + '★돌릴 사람: 머리말의 양성대조 ㉠㉡㉢ 을 ★먼저 세우고 ★이 skip 을 떼라. '
    + '★1017t1h3 이 9334 실 DOM 에서 손으로 잰 17/17 은 ★모듈 단위였고 ★「사람이 하는 순서」가 ★아니다.');

  test.beforeEach(async ({ page }) => { await bootApp(page); });

  test('RL1~RL12 — 머리말 참조', async ({ page }) => {
    void page; void waitStableRect; void clickAt; void SEC; void expect;
    /* ⛔몸통을 ★짐작으로 채워 두지 않았다 — ★안 돌린 검사의 ★몸통은 ★「돈 것처럼 보이는」 거짓 기록이 된다.
       ★돌릴 사람이 ★annotation-1013t2.dom.spec.js 의 `drawAnnotation`/`makeAnnotation` 를 그대로 빌려
       ★머리말 RL1~RL12 순서로 ★채운다(그 파일이 ★같은 블럭의 ★같은 손짓을 이미 세워 두었다). */
  });
});
