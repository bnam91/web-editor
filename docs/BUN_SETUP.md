# Bun 설치 가이드

> Figma 연동 기능을 사용하려면 [Bun](https://bun.sh) 런타임이 필요합니다.
> 상페마법사 본체 동작에는 영향이 없으며, **Figma 동기화 기능을 쓰지 않으면 설치하지 않아도 됩니다.**

## 왜 Bun이 필요한가요?

상페마법사의 **Figma 양방향 동기화**는 로컬 WebSocket 브리지를 통해 작동합니다. 이 브리지는 Bun 런타임으로 구동돼요.

- 에디터에서 만든 섹션 → Figma에 자동 업로드
- Figma에서 디자인한 프레임 → 에디터로 가져오기

이 기능을 안 쓰시면 이 문서는 무시하셔도 됩니다.

---

## macOS 설치

### 방법 1: 공식 인스톨러 (추천)

터미널을 열고 아래 명령어를 붙여넣으세요:

```bash
curl -fsSL https://bun.sh/install | bash
```

설치가 끝나면 터미널을 **완전히 닫았다가 다시 열고** 확인:

```bash
bun --version
```

`1.x.x` 같은 버전 번호가 뜨면 성공입니다.

### 방법 2: Homebrew

이미 Homebrew가 설치되어 있다면:

```bash
brew install oven-sh/bun/bun
```

---

## Windows 설치

### 방법 1: PowerShell (추천)

**PowerShell**을 관리자 권한으로 열고 아래 명령어를 실행하세요:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

설치가 끝나면 PowerShell을 **닫았다가 다시 열고** 확인:

```powershell
bun --version
```

### 방법 2: Scoop

[Scoop](https://scoop.sh)이 설치되어 있다면:

```powershell
scoop install bun
```

### 방법 3: npm (Node.js가 설치되어 있다면)

```powershell
npm install -g bun
```

---

## 설치 확인 후

1. 상페마법사를 **완전히 종료**합니다 (작업표시줄/Dock에서도 끄기)
2. 다시 실행합니다
3. 우측 상단 **Figma 연동** 패널에서 **"브리지 시작"** 버튼을 눌러보세요
4. 상태가 **"실행 중 (포트 3055)"**으로 바뀌면 성공입니다

---

## 문제가 생겼을 때

### "bun을 찾을 수 없습니다" 에러가 떠요
- 설치 후 **터미널/PowerShell을 완전히 닫았다가** 새 창을 열어보세요
- 그래도 안 되면 컴퓨터를 한 번 재시작해주세요 (PATH 환경변수 갱신 필요)

### 설치는 됐는데 상페마법사가 인식 못해요
상페마법사를 완전히 종료 후 다시 실행해주세요. 앱 시작 시점에 Bun 경로를 검색합니다.

### Windows에서 "이 시스템에서 스크립트를 실행할 수 없으므로..." 에러
PowerShell 실행 정책 때문이에요. 관리자 권한 PowerShell에서:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

입력하고 다시 설치 명령어를 실행해주세요.

### 회사 보안 정책으로 설치가 막혀요
IT 담당자께 다음 사이트 화이트리스트 등록을 요청하세요:
- `bun.sh`
- `github.com/oven-sh/bun`

---

## 더 알아보기

- 공식 사이트: https://bun.sh
- 설치 문서: https://bun.sh/docs/installation
- 문제 신고: 상페마법사 고객센터로 문의해주세요
