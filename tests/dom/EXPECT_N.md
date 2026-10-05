# EXPECT_N — DOM 전수에서 «돌아야 하는» 시험 수 (머지 게이트 ⑵)

전수(`npx playwright test --config=tests/dom/playwright.dom.config.js`)가 돈 시험 수가 이 값과 다르면 그 판은 무효다
(0건이 초록 · 파일이 통째로 안 돎 · spec 이 조용히 빠짐을 막는다).

## 현재값

| 값 | 어느 커밋에서 셌나 | 어떻게 셌나 | 기록 |
|---|---|---|---|
| **2543** | `0f572e2a` (dev · integ24) | `--list` 의 `Total:` 줄 | 2026-10-05 태양 |

⚠️절대값은 한 출처(`--list`)다 — 「언제부터 셌나」이지 「언제부터 맞나」가 아니다. 게이트가 지키는 것은 **델타**다.

## 갱신 식

```
새 N = 옛 N + 들인 수 − 뺀 수
```

두 항은 **바뀐 spec 마다** 두 출처가 따로 낸다. 어긋나면 그 spec 을 이름으로 설명한다.

- 출처 ㉠ git — `test(` 선언 수(playwright 를 안 쓴다):

  ```sh
  for f in $(git diff --name-only <base>..<head> -- 'tests/dom/*.spec.js'); do echo "$f $(git show <base>:$f 2>/dev/null | grep -cE '^[[:space:]]*test\(') $(git show <head>:$f 2>/dev/null | grep -cE '^[[:space:]]*test\(')"; done
  ```
  (줄마다 `파일 옛수 새수` — 늘어난 합 = 들인 수, 줄어든 합 = 뺀 수. ⚠️macOS grep 은 `\s` 를 모른다 → `[[:space:]]`.)
- 출처 ㉡ `--list` — 두 판에서 spec 별 실행 단위 수.

어긋남이 정당한 꼴: 반복문 안 `test(` · `test.each` · describe 반복 · `test.skip` (선언 수 ≠ 실행 단위 수).
예) integ24: 식 2536 ≠ 2543 — graph-panel-defaults · k2 · k3 · k5 의 반복 생성 +7 을 이름으로 설명했다.

## 자

`~/.claude/skills/지디/tools/expect-n.sh <base> <head>` (PIN · REPO · OUT 환경변수) — 아직 레포 밖이다(☐ 0.9.7 첫 묶음에서 레포 안으로 · 임자 태양).
자가 밖에 있어도 **값과 식은 여기**가 정본이다. 머지할 때마다 위 «현재값» 줄을 고친다.
