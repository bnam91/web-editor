/* limits.js — .gdt 입력 상한 (GDT-SPEC §11)
 *
 * ★`.gdt` 는 «남이 준 파일»이다. 손상된 파일과 «공격자가 만든 파일»은 형태가 다르다 —
 *   손상은 우연이고 공격은 의도라, 「검증을 통과하도록」 만들어진다.
 *
 * 실측 재현(2026-08-07): 이미지 1장 + 그 1장을 가리키는 참조 1,000개를 담은
 *   4,042바이트 `.gdt` 가 `verifyGdt` 를 «통과»하고(고유 참조는 1개니까),
 *   불러오기가 디스크에 63,507,495바이트를 «실제로 썼다» — 15,712배 증폭.
 *   개수 불일치 검사는 다 쓴 «뒤»에 왔다. 참조 10만 개면 같은 방식으로 수 GB 다.
 *
 * ── 상한을 정한 근거: 정상 사용의 실측 최대값 ──
 *   원본 proj.json        108,013,122 B   (두장군_복구)
 *   .gdt                   80,891,586 B
 *   아카이브 엔트리 수              56     (manifest+project+이미지 54)
 *   이미지 장수                     54
 *   단일 이미지 최대        4,846,816 B
 *   아카이브 내 project.json  509,763 B   (끌리젠, 최대)
 *   gdt:// 참조 총 개수              54
 *   내보내기 1.8s · 불러오기 0.32s
 *
 * ⇒ 상한은 위의 «몇 배~수십 배» 안쪽으로 둔다. 정상 사용을 막으면 안 되지만
 *   무한이어서도 안 된다. 각 값 옆에 «정상 최대 대비 배수»를 적어둔다.
 */
'use strict';

const MB = 1024 * 1024;

const LIMITS = {
  // 아카이브 구조
  ENTRY_COUNT:          5000,          // 정상 56 → 89배
  IMAGE_COUNT:          5000,          // 정상 54 → 92배
  SINGLE_ENTRY_BYTES:   64 * MB,       // 정상 4.85MB → 13배. ★verifyGdt 가 엔트리를 통째 Buffer 로 읽는다(RSS 직격)
  TOTAL_UNCOMPRESSED:   1024 * MB,     // 정상 ~60MB → 17배. ★압축 해제 «전»에 uncompressedSize 합으로 검사
  PROJECT_JSON_BYTES:   32 * MB,       // 정상 0.51MB → 64배. 통째 파싱·문자열화하므로 실사용 메모리는 이 값의 2배

  // ★참조 증폭 방어 (§11-1)
  REF_TOTAL:            50000,         // 정상 54 → «전체» 참조 개수. 고유가 아니다
  OUTPUT_BYTES:         1024 * MB,     // 정상 108MB → 9배. ★쓰는 «중»에 누적 검사한다

  // 시간
  TIMEOUT_MS:           180000,        // 정상 내보내기 1.8s·불러오기 0.32s
};

/** 상한 초과를 «거부 코드»로 표현한다 — 사용자 문구 번역이 붙어야 하므로 code 를 고정한다. */
class LimitError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? ` (${detail})` : ''}`);
    this.code = code;
    this.detail = detail;
  }
}

/** 마감시각 기반 타임아웃 — 루프 경계에서 확인한다(강제 kill 이 아니라 협조적 중단). */
function makeDeadline(ms = LIMITS.TIMEOUT_MS) {
  const until = Date.now() + ms;
  return {
    check(where) {
      if (Date.now() > until) throw new LimitError('timeout', where);
    },
  };
}

const fmtMB = (b) => (b / MB).toFixed(1) + 'MB';

module.exports = { LIMITS, LimitError, makeDeadline, MB, fmtMB };
