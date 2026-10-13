/* ══════════════════════════════════════
   종이 텍스처 8종 — background 폴더 아래 「texture paper」 하위 폴더 «한 번만» 시드 (1013t2A4)
   - 파일은 앱에 동봉한다: assets/textures/paper/paper-01..08.jpg (원본: 종이 루프 영상 8개의 t=5s 프레임 · 2048×1152 JPEG)
   - 노드는 인라인 data URI 를 갖지 않는다 — `bundled`(앱 루트 상대 경로)만 갖는다.
     읽기: assets-panel.js assetsGetDataUrl 의 bundled 갈래 → IPC assets:readBundled(main/bundled-asset.js 가드) → data URL.
     그래서 프로젝트 JSON 은 노드 9개 분량(수백 B~1 KB)만 는다.
   - ★노트패널 시드(save-load.js seedNoteBgPatterns)와 다른 점 (지디 승인 조건):
     ⓐ 보호하지 않는다 — locked 없음. 사용자가 폴더째·한 장씩 지울 수 있다.
     ⓑ «한 번만» 시드 — background 폴더에 표식(PAPER_TEX_SEED_MARK)을 남기고, 표식이 있으면 다시 만들지 않는다.
        ⛔매 로드 「없으면 만든다」가 아니다 — 지운 것이 되살아나면 안 된다.
     ⓒ 옛 프로젝트(표식 없음)는 첫 열기 때 한 번 시드된다(새 프로젝트와 같은 길).
   - ⚠️이 파일은 import 가 없어야 한다 — 유닛 검사(tests/unit/texture-paper-seed.test.mjs)가 이 파일 하나만 복사해 싣는다.
══════════════════════════════════════ */

export const PAPER_TEX_FOLDER_ID = 'ast_paperbg_folder';
export const PAPER_TEX_FOLDER_NAME = 'texture paper';
/* 표식: background(texture:true) 폴더 노드의 `seeded` 배열에 이 문자열이 있으면 «이미 한 번 시드했음».
   background 폴더는 보호 폴더(삭제·이동 불가)라 표식이 사용자 손에 지워지지 않는다. */
export const PAPER_TEX_SEED_MARK = 'paper-textures-v1';

export const PAPER_TEXTURES = [
  { id: 'ast_paperbg_01', name: 'paper-01', bundled: 'assets/textures/paper/paper-01.jpg' },
  { id: 'ast_paperbg_02', name: 'paper-02', bundled: 'assets/textures/paper/paper-02.jpg' },
  { id: 'ast_paperbg_03', name: 'paper-03', bundled: 'assets/textures/paper/paper-03.jpg' },
  { id: 'ast_paperbg_04', name: 'paper-04', bundled: 'assets/textures/paper/paper-04.jpg' },
  { id: 'ast_paperbg_05', name: 'paper-05', bundled: 'assets/textures/paper/paper-05.jpg' },
  { id: 'ast_paperbg_06', name: 'paper-06', bundled: 'assets/textures/paper/paper-06.jpg' },
  { id: 'ast_paperbg_07', name: 'paper-07', bundled: 'assets/textures/paper/paper-07.jpg' },
  { id: 'ast_paperbg_08', name: 'paper-08', bundled: 'assets/textures/paper/paper-08.jpg' },
];

/** background 폴더에 「texture paper」 + 8장을 «한 번만» 넣는다.
 *  돌려주는 것: 이번에 시드했으면 true, 표식이 있어 건너뛰었으면 false. */
export function seedPaperTexturesOnce(bgFolder, nowIso) {
  if (!bgFolder || typeof bgFolder !== 'object') return false;
  if (!Array.isArray(bgFolder.seeded)) bgFolder.seeded = [];
  if (bgFolder.seeded.includes(PAPER_TEX_SEED_MARK)) return false;   // ★한 번만 — 지운 뒤엔 다시 안 만든다
  if (!Array.isArray(bgFolder.children)) bgFolder.children = [];
  const at = nowIso || new Date().toISOString();
  // 표식이 없는데 같은 id 폴더가 이미 있으면(표식만 잃은 경우) 겹쳐 만들지 않는다 — 표식만 남긴다
  const exists = bgFolder.children.some(n => n && n.id === PAPER_TEX_FOLDER_ID);
  if (!exists) {
    bgFolder.children.push({
      id: PAPER_TEX_FOLDER_ID,
      type: 'folder',
      name: PAPER_TEX_FOLDER_NAME,
      children: PAPER_TEXTURES.map(p => ({
        id: p.id,
        type: 'image',
        name: p.name,
        bundled: p.bundled,
        thumbSrc: p.bundled,   // index.html(앱 루트) 기준 상대 URL — 패널 썸네일이 IPC 없이 바로 뜬다
        mime: 'image/jpeg',
        addedAt: at,
      })),
      collapsed: false,
    });
  }
  bgFolder.seeded.push(PAPER_TEX_SEED_MARK);
  return true;
}
