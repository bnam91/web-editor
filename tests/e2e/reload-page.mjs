/* reload-page.mjs — 앱 화면을 «캐시 무시»로 다시 읽힌다.
 * 쓰임: 제품 파일을 바꾼 «뒤»(예: T-085 양성대조로 고침을 되돌린 뒤) 그 변경이
 *   실제로 렌더러에 반영되게 한다. 안 부르면 옛 모듈이 메모리 캐시로 그대로 돈다.
 * 실행: node tests/e2e/reload-page.mjs [port]   (저장소 뿌리에서)
 */
import { connect } from './lib/cdp.mjs';
const s = await connect(Number(process.argv[2] || 9531), '');
await s.send('Page.reload', { ignoreCache: true });
await s.sleep(5000);
console.log(await s.eval('return {p: location.pathname.split("/").pop()}'));
s.close();
