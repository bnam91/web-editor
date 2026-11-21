/* text-lorem.js — 더미 글 만들기(TEXT-LOREM-FILL-01 · 현빈 261121 · 피그마 «Lorem ipsum» 플러그인 결: 단어·문장·문단 길이를 정해 글 칸을 채운다)
 * 순수(DOM 0 · import 0) — 단위가 data: URL 로 그대로 읽는다(tests/unit/text-lorem.test.mjs). 쓰는 자리 = js/props/prop-text-wireup-lorem.js.
 * lang 'en' = 고전 lorem 낱말(키케로 라틴 · 공유 자산) · 'ko' = 한글 더미(우리가 고른 낱말 · 선택지로만 — 기본은 en).
 * seed 를 주면 같은 글(시험용) · 안 주면 누를 때마다 다른 글.
 */
export const LOREM_UNITS = Object.freeze(['word', 'sentence', 'paragraph']);
export const LOREM_LANGS = Object.freeze(['en', 'ko']);
export const LOREM_MAX = Object.freeze({ word: 200, sentence: 30, paragraph: 10 });
export const LOREM_DEFAULT = Object.freeze({ unit: 'sentence', count: 2, lang: 'en' });

const EN = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud ' +
  'exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');
const KO = ('하루 바람 가벼운 공간 오늘 우리 새로운 작은 마음 이야기 시간 함께 천천히 따뜻한 빛 길 소리 기억 사람 계절 모양 색 노래 아침 저녁 물결 창가 손끝 ' +
  '조용한 선명한 부드러운 하나씩 다시 멀리 가까이 처음 마지막 생각 풍경 여름 겨울 숲 도시 정원 구름 오후 걸음').split(' ');
const KO_END = ['이어집니다', '머뭅니다', '펼쳐집니다', '흐릅니다', '남습니다', '다가옵니다'];   // 낱말 뒤 띄어 붙는 끝말(명사에 바로 붙이면 «저녁있습니다» 꼴)

/** 씨앗 난수(mulberry32) — 같은 씨앗 = 같은 글. */
function rng(seed) {
  let a = (Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/** 옵션 소독 — 모르는 단위·글은 기본값 · 개수 1..LOREM_MAX[unit] 정수. */
export function normLorem(o) {
  const s = o && typeof o === 'object' ? o : {};
  const unit = LOREM_UNITS.includes(s.unit) ? s.unit : LOREM_DEFAULT.unit;
  const lang = LOREM_LANGS.includes(s.lang) ? s.lang : LOREM_DEFAULT.lang;
  const n = Math.round(Number(s.count));
  const count = Number.isFinite(n) ? Math.max(1, Math.min(LOREM_MAX[unit], n)) : LOREM_DEFAULT.count;
  return { unit, lang, count };
}

function words(r, lang, n) { const bank = lang === 'ko' ? KO : EN; return Array.from({ length: n }, () => pick(r, bank)); }
function sentence(r, lang, first) {
  if (lang === 'ko') return words(r, 'ko', between(r, 4, 8)).join(' ') + ' ' + pick(r, KO_END) + '.';
  const w = first ? ['lorem', 'ipsum', ...words(r, 'en', between(r, 4, 10))] : words(r, 'en', between(r, 6, 12));
  w[0] = w[0][0].toUpperCase() + w[0].slice(1);
  if (w.length > 7 && r() < 0.5) w[between(r, 2, w.length - 3)] += ',';
  return w.join(' ') + '.';
}

/** 조각 배열 — word = 낱말 n개 · sentence = 문장 n개 · paragraph = 문단 n개(문장 3~5). 불릿은 조각마다 li 한 줄. */
export function loremPieces(opts, seed) {
  const { unit, lang, count } = normLorem(opts), r = rng(seed);
  if (unit === 'word') { const w = words(r, lang, count); if (lang === 'en') w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w; }
  if (unit === 'sentence') return Array.from({ length: count }, (_, i) => sentence(r, lang, i === 0));
  return Array.from({ length: count }, (_, p) => Array.from({ length: between(r, 3, 5) }, (_, i) => sentence(r, lang, p === 0 && i === 0)).join(' '));
}

/** 보통 글 한 덩이 — 낱말·문장은 띄어 잇고, 문단 사이는 빈 줄('\n\n'). */
export function loremText(opts, seed) {
  const { unit } = normLorem(opts), p = loremPieces(opts, seed);
  return p.join(unit === 'paragraph' ? '\n\n' : ' ');
}
