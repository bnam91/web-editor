# 메모: logo(고정 너비) asset block 너비 오버라이드 문제

## 현상

`logo` preset으로 freeLayout frame 안에 블록을 추가하면 너비가 200px이 아니라 colW(474px 등)로 들어온다.
이 문제가 여러 번 반복됨.

## 원인

### runner 측
`buildBlockInFrame`에서 `image` 타입은 항상 `{ x, y, width: colW }` 형태로 opts를 전달한다.

```javascript
// 현재 runner 코드 (문제 있음)
const imgOpts = { x, y, width };  // width = colW (항상)
await ev(`window.addAssetBlock('${block.preset}', ${JSON.stringify(imgOpts)})`);
```

`logo` preset은 고정 너비 200px이지만 runner가 colW를 width로 넘겨버린다.

### block-factory.js 측
`applyPreset` 안에서:
```javascript
// ASSET_PRESETS.logo = { width: 200, height: 64 }
// applyPreset은 preset의 고정 width가 있으면 opts.width로 덮어쓰지 않도록 보호
if (opts.width && !ASSET_PRESETS[preset]?.width) block.style.width = opts.width + 'px';
```
이 보호 코드가 있어도 `_insertToFlowFrame`에서 `opts.width`를 읽어서 `widthVal`을 덮어쓴다.

## 올바른 수정 방법

### 방법 A — runner에서 logo 전용 처리 (권장)

runner의 `buildBlockInFrame`에서 `logo` preset은 width를 전달하지 않는다:

```javascript
case 'image': {
  // logo preset은 width 고정(200px) — opts.width 전달 시 applyPreset이 덮어쓰므로 제외
  const imgOpts = block.preset === 'logo' ? { x, y } : { x, y, width };
  if (block.height !== undefined) imgOpts.height = block.height;
  await ev(`window.addAssetBlock('${block.preset || 'standard'}', ${JSON.stringify(imgOpts)})`);
  ...
}
```

spec에서 `logo` preset을 쓸 때 width 필드를 넣지 않으면 runner도 colW를 넘기지 않는다.

### 방법 B — block-factory.js `_insertToFlowFrame` 수정

freeLayout frame에 삽입할 때 preset 고정 너비가 있으면 opts.width를 무시:

```javascript
// _insertToFlowFrame 내부
const presetFixedW = ASSET_PRESETS[block.dataset.preset]?.width;
const widthVal = presetFixedW
  ? presetFixedW + 'px'
  : (opts.width ? opts.width + 'px' : (block.style.width || '100%'));
```

## 핵심 규칙

> **logo(또는 고정 너비 preset)를 freeLayout frame에 추가할 때는 width를 opts로 넘기지 않는다.**
> runner는 `block.preset === 'logo'` 조건으로 imgOpts에서 width 필드를 제외한다.

## 영향 범위

- `logo` preset만 해당 (유일하게 width가 고정된 preset)
- `standard`, `square`, `tall`, `wide`는 height만 고정이므로 기존 방식(width = colW) 유지

## 관련 파일

- `/Users/a1/web-editor/scripts/goditor_runner.js` — `buildBlockInFrame` case 'image'
- `/Users/a1/web-editor/js/block-factory.js` — `applyPreset`, `_insertToFlowFrame`
