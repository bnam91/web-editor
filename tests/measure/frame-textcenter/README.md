# 실측 하네스 — 프레임 «신규 추가» 텍스트 중앙정렬 (2026-09-05)

앱(Electron)을 안 띄우고, **실제 CSS + 실제 소스 모듈**을 headless Chromium 에 물려 재는 하네스다.
`tests/measure/frame-p1/` 의 구조를 그대로 재사용하고 `js/block-drag.js` 를 추가로 로드한다
(섹션→프레임 HTML5 드롭 경로를 실제 핸들러로 재현하기 위해).

## 실행

```bash
node tests/measure/frame-textcenter/serve.js "$PWD" &      # :8899
node tests/measure/frame-textcenter/00-probe.js            # 모듈 3본이 실제로 로드되는지
node tests/measure/frame-textcenter/01-before.js           # 현행(고치기 전) 전 시나리오
node tests/measure/frame-textcenter/02-axis.js             # (c) 「보여지는 가로너비」 축 비교(줌 포함)
node tests/measure/frame-textcenter/03-after.js            # 01 과 «같은 시나리오» — 고친 뒤
node tests/measure/frame-textcenter/04-saveload-gate.js    # 저장본 무변경 게이트(rebindAll)
node tests/measure/frame-textcenter/05-drop-narrow.js      # (b) 드롭 — 좁은 블록 가로중앙
```

## ★기준선과 «교차» 비교하는 법 (이 브랜치만 재면 「안 바뀌었다」를 증명 못 한다)

```bash
mkdir -p /tmp/ftc-base && git archive origin/feat/frame-p1 | tar -x -C /tmp/ftc-base
cp -R tests/measure/frame-textcenter /tmp/ftc-base/tests/measure/
sed -i '' 's/8899/8898/g' /tmp/ftc-base/tests/measure/frame-textcenter/*.js
ln -sfn "$PWD/node_modules" /tmp/ftc-base/node_modules
(cd /tmp/ftc-base && node tests/measure/frame-textcenter/serve.js "$PWD" &)
```
그 다음 양쪽에서 `01-before.js` / `04-saveload-gate.js` 를 돌려 JSON 을 대조한다.
`04` 는 `①loadPath_afterHTML` 전문을 덤프하므로 **두 빌드의 로드 결과를 바이트 비교**할 수 있다.

## 주의

- `02-axis.js` 는 `#canvas-scaler` 의 `transition: transform .15s` 를 **끄고** 재야 한다.
  안 끄면 `getComputedStyle` 이 «전이 시작값(항등)»을 돌려줘 줌이 안 걸린 것처럼 보인다(실제로 겪음).
- `04-saveload-gate.js` 는 `rebindAll` 이 부르는 «섹션 크롬» 바인더(editor.js 전역)를 no-op 으로 세운다.
  이번 변경이 안 건드린 것들이라 무해하지만, **이 게이트가 재는 건 DOM 정규화·블록 재바인딩 구간**이다.
- 하네스는 **앱이 아니다** — index.html 도 Electron 도 안 띄운다.
