/* ═══════════════════════════════════
   BULK-ALIGN-TARGETS — 섹션 일괄 정렬이 «옮길 것»을 고르는 한 자리
   ⛔이 파일은 의존성이 없다(import 0). 그래야 DOM 검사가 editor.js 를 안 끌고
     이 규칙만 «진짜 CSS 위에서» 잴 수 있다 — tests/dom/bulk-align-section.dom.spec.js.
     변이 책임(=`npm test`)은 tests/unit/bulk-align-targets.test.mjs 가 진다.
   ─────────────────────────────────────
   [T-095] 무엇을 옮길지 «성질»로 고른다
   예전엔 `sec.querySelectorAll('.text-block')` 뿐이라 글자만 움직이고 이미지·도형은
   제자리였다(재현: dev 3f39b71 — 오른쪽 정렬 후 shape L=152·asset L=112 불변).
   ⛔고치는 방법으로 «블록 이름 명부»를 새로 적지 않는다 — 이 레포는 손목록이 하나
     빠져서 난 사고가 반복됐다(FLOW_BLOCK_SEL_SELECTED 사본 갈림, 2026-09-08).
   ★대신 구조의 성질을 쓴다:
     section-inner / row / frame-block 은 전부 flex-direction:column 이다.
     그 안에서 자식의 «가로 자리»를 정하는 건 align-self 하나뿐이고,
     부모 콘텐츠 폭을 «꽉 채운» 자식은 align-self 로 움직일 여지가 아예 없다
     — 진짜 움직일 놈은 그 «안»에 있다(예: row(100%) > asset-block(300px)).
   ⇒ 「폭에 여유가 있나」로 갈라서, 여유 있으면 그놈이 대상, 꽉 찼으면 한 칸 내려간다.
     이름을 묻지 않으므로 새 블록 타입이 생겨도 저절로 따라온다.
   ★글자는 예외다 — text-block 은 폭 100% 라 위 규칙으로는 영영 «꽉 참»이지만,
     가로 자리를 text-align 이 지배한다. 만나면 바로 대상으로 넣고 안 내려간다.
   ★자유배치(position:absolute)는 좌표가 지배한다 — 이 단추가 건드릴 축이 아니다.
     단, 그 «안»의 글자는 예전에도 움직였으므로 회귀를 막으려고 따로 훑어 합친다.
═══════════════════════════════════ */
export function collectBulkAlignTargets(sec) {
  const inner = sec.querySelector('.section-inner') || sec;
  const out = new Set();
  const visit = (parent, depth) => {
    if (depth > 8) return;                       // 병적 깊이 방어(정상 트리는 2~4)
    const pcs = getComputedStyle(parent);
    if (!/flex/.test(pcs.display)) return;                 // align-self 가 안 듣는 그릇
    if (!pcs.flexDirection.startsWith('column')) return;   // row 방향은 justify-content 축(다른 기전)
    const avail = parent.clientWidth
      - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
    for (const c of parent.children) {
      if (c.nodeType !== 1) continue;
      if (c.classList.contains('gap-block')) continue;     // 스페이서 — 옮길 «자리»가 없다
      if (c.classList.contains('text-block')) { out.add(c); continue; }
      if (getComputedStyle(c).position === 'absolute') continue;   // 자유배치 = 좌표축
      if (c.offsetWidth < avail - 0.5) { out.add(c); continue; }    // 여유가 있다 = 이놈이 움직인다
      visit(c, depth + 1);                                          // 꽉 찬 래퍼 — 진짜는 더 안쪽
    }
  };
  visit(inner, 0);
  // 회귀 방어 — 예전 동작(전수 .text-block 에 text-align)을 그대로 포함시킨다
  sec.querySelectorAll('.text-block').forEach(tb => out.add(tb));
  return [...out];
}
