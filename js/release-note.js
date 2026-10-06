/* ══════════════════════════════════════════════════════════════════════════
   release-note.js — 업데이트 후 «무엇이 달라졌는지» 한 번 알린다 (A4)
   ★새 룩을 만들지 않는다(현빈 상시 지시, notice.css 와 같은 규약):
     껍데기는 .settings-modal-overlay / -shell / -header / -footer 를 그대로 쓴다.
     여기서 더하는 건 «목록 한 칸»(.relnote-list) 뿐이다.
   ★간결형 확정(현빈 2026-09-04) — 제목만 훑게 하고 설명은 붙이지 않는다.
   언제 뜨나: 저장된 「마지막으로 본 버전」과 지금 버전이 «다를 때» 1회.
     · 같은 버전 재실행 → 안 뜬다
     · 신규 설치(저장값 없음) → 안 뜬다(비교할 이전 버전이 없다)
     · 「일주일간 안 보기」 → 이후 버전에서도 안 뜬다
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const KEY_SEEN = 'goditor.relnote.lastSeen';
  const KEY_OFF  = 'goditor.relnote.off';

  /* 릴리스마다 «사람이» 5줄 쓴다 — 커밋에서 자동으로 뽑지 않는다.
     커밋 메시지를 그대로 옮기면 사용자 말이 안 나오고 내부 작업이 섞여 나간다. */
  const NOTES = {
    '0.9.6': {
      date: '2026-10-06',
      items: [
        { k: 'fix', t: '끌어서 옮긴 것이 저장되지 않던 것',
          d: '블럭을 끌어 자리를 옮긴 뒤 다른 편집 없이 닫으면 옮기기 전으로 돌아가 있던 문제(그리드 칸에 넣은 것도) · 0.5.0 부터 있던 것' },
        { k: 'fix', t: '끌리지 않던 블럭들',
          d: '섹션에 바로 넣은 도형 · 스티커로 묶은 프레임 · 프레임 안 가운데 정렬 글자 · 도형과 글자를 같이 골랐을 때' },
        { k: 'fix', t: '템플릿으로 넣은 블럭이 만져지지 않던 것',
          d: '섹션 템플릿·「A/B 변형 추가」로 넣은 도형·차트·채팅·프레임이 선택도 끌기도 되지 않던 문제' },
        { k: 'new', t: '그리드 블럭 대폭 강화',
          d: '칸 수 8×8 까지 · 모서리 손잡이로 폭 조절 · ＋ 버튼으로 행·열 추가 · 칸에 갭 넣기 · 칸 배경 이미지' },
        { k: 'new', t: '그래프를 캔버스에서 바로',
          d: '카테고리 이름 더블클릭 수정 · 꺾은선 빈 점 모양 고르기 · 격자선 색 직접 지정' },
        { k: 'imp', t: '어두운 배경 자동 밝기',
          d: '격자선·꺾은선·점이 바탕과 충분히 구분되는 선명도에 닿을 만큼 자동으로 밝아짐(직접 색을 바꾸면 꺼짐)' },
        { k: 'fix', t: '되돌리기(⌘Z)로 되살아나지 않던 것',
          d: '블럭·행·열·월계·에셋을 지우고 ⌘Z 해도 돌아오지 않던 문제 · 스크래치 카드가 그리드를 덮던 문제' },
        { k: 'fix', t: '블럭이 들어가는 자리',
          d: '프레임을 고른 채 넣으면 안으로 들어가던 문제 · 왼쪽 폴더 이미지를 끌어 놓으면 맨 끝으로 가던 문제 · 프레임 폭을 줄이면 글자가 깨지던 문제' },
      ],
    },
    '0.9.5': {
      date: '2026-10-02',
      items: [
        { k: 'new', t: '합친 섹션을 다시 «분리»',
          d: '합쳐 넣은 블럭을 우클릭해 「섹션 분리」 또는 ⌘⇧M. 섹션 이름과 이음매 여백까지 되돌아갑니다. 예전에 합친 것은 이름·여백이 기본값으로 돌아가고 그 사실을 알려 드립니다' },
        { k: 'new', t: '최근 쓴 색',
          d: '색 칸 아래 「최근」 줄에 방금 쓴 색 7개. 프로젝트마다 따로 쌓이고, 글자색·배경·테두리가 한 목록을 같이 씁니다. 우클릭하면 컬러 변수로 올릴 수 있습니다' },
        { k: 'new', t: '빈 바닥에서 끌면 섹션·블럭도 함께 선택',
          d: '선택상자가 스크래치 항목만 잡던 것이 섹션과 블럭까지 잡습니다. 크게 끌면 섹션, 작게 끌면 그 안 블럭' },
        { k: 'new', t: '그리드를 섹션 위에 띄우기',
          d: '글자·도형·에셋처럼 그리드도 «오버레이로 전환». 떠 있는 동안 폭이 굳어 다시 그려도 자리를 지킵니다' },
        { k: 'new', t: '그리드 칸 안 원형 이미지 · 칸 사이 괘선',
          d: '우클릭 「원형 이미지 추가」로 정원 이미지. 이미 넣은 이미지는 「원형으로 / 사각으로 바꾸기」. 칸 경계마다 세로줄·가로줄을 켜고 끌 수 있습니다' },
        { k: 'new', t: '떠 있는 블럭끼리 서로 맞추기',
          d: '오버레이 블럭을 여럿 고르면 좌·가운데·우 / 위·가운데·아래 정렬과 가로·세로 균등분배. ⌘G 로 묶고 ⌘[ ⌘] 로 앞뒤를 바꿉니다' },
        { k: 'new', t: '에셋을 스크래치패드로 되돌리기 · 섹션 배경으로',
          d: '에셋 블럭을 섹션 밖으로 끌면 이미지 효과째 스크래치패드로 돌아갑니다(우클릭 「스크래치로 보내기」는 복사). 우클릭으로 그 섹션 배경에 넣거나, 섹션 배경을 스크래치로 보낼 수 있습니다' },
        { k: 'new', t: '노트패널 더블클릭 = 크게 보기',
          d: '더블클릭하면 섹션 선택을 묻지 않고 큰 미리보기가 뜹니다. 넣기는 그 창의 단추로' },
        { k: 'new', t: '연결선 더블클릭으로 참고이미지 당기기',
          d: '섹션과 이어 둔 참고이미지를 섹션 옆 빈 자리로 끌어옵니다' },
        { k: 'imp', t: '구분선 가로 너비 · 그리드 행 간격 음수',
          d: '가로 구분선에 너비 슬라이더(끝까지 올리면 전폭). 그리드 행 간격을 -50 까지 줄여 줄끼리 겹칠 수 있습니다' },
        { k: 'imp', t: '썸네일 찍기가 편집을 끊던 것',
          d: '편집이 멈춘 뒤 드물게 찍습니다. 홈으로 나갈 때도 썸네일을 기다리지 않습니다' },
        { k: 'fix', t: '끌어 놓은 자리가 아닌 데 생기던 문제',
          d: '노트패널에서 캔버스로 끌어 놓으면 놓은 그 자리에 들어갑니다. 섹션 안이면 섹션에, 밖이면 스크래치패드 그 자리에' },
        { k: 'fix', t: '컬러 변수 추가·디자인시스템 저장이 눌리는 순간 죽던 문제',
          d: '이름을 묻는 창이 뜨지 않고 아무 일도 안 되던 것 — 패널 안 입력칸으로 바뀌었습니다' },
        { k: 'fix', t: '바깥에서 복사한 이미지가 안 붙던 문제',
          d: '고디터에서 ⌘C 한 적이 있으면 카톡·캡처·인터넷 이미지를 ⌘V 해도 예전 블럭이 붙던 것 — 더 최근에 복사한 쪽이 붙습니다' },
        { k: 'fix', t: '프레임 안에서 묶기·옮기기가 안 되던 문제',
          d: '프레임과 줌 블럭을 ⇧클릭으로 골라 ⌘G 로 묶을 수 있습니다. 패널로 넣은 그리드 등도 프레임 안에서 자유롭게 끌어 옮깁니다' },
        { k: 'fix', t: '「좌우 패딩 제외」 두 가지',
          d: '다시 그리면 오른쪽에만 패딩이 남던 것, 그리고 프레임 안에서는 아예 먹지 않던 것. 이제 모서리를 둥글린 프레임에서만 막힙니다' },
        { k: 'fix', t: '프로젝트 설정이 서로 덮어쓰던 문제',
          d: '색 변수·썸네일·브랜치 정보를 여러 곳이 같은 파일에 쓰면서 한쪽 변경이 조용히 되돌아가던 것 — 6 곳을 고쳤습니다' },
        { k: 'fix', t: '프로젝트 카드 썸네일에 섹션 그림이 빠지던 문제',
          d: '그림이 든 섹션을 찍을 때 아직 바뀌지 않은 주소를 읽어 배경만 찍히던 것. 느린 기계나 일이 많을 때 잘 났고, 빠진 채로 저장돼도 알 길이 없었습니다' },
        { k: 'fix', t: '캔버스에 템플릿 태그가 라벨로 뜨던 문제',
          d: '템플릿으로 섹션을 추가하면 저장할 때 넣은 태그가 캔버스에 보이던 것. 섹션 「체크 배경으로 두기」가 아무것도 안 그리던 것과, 투명도 칸에서 Enter 뒤 ⌘Z 가 엉뚱하게 먹던 것도 고쳤습니다' },
      ],
    },
    '0.9.4': {
      date: '2026-09-28',
      items: [
        { k: 'new', t: '그리드 칸 안을 글줄 단위로 다루기',
          d: '칸 안에서 줄을 더하고, ⌘↑↓ 와 ⌘←→ 로 옮기고, ⠿ 손잡이로 끌어 옮깁니다. 칸을 둘로 나눠 나란히 두고, 그 안 글자를 더블클릭해 고칠 수 있습니다' },
        { k: 'new', t: '그리드 칸 테두리',
          d: '칸에 선을 넣어 스펙표·비교표가 표로 보입니다. 전에는 배경색으로 흉내만 냈습니다' },
        { k: 'new', t: '프로젝트를 폴더로 정리하고 검색',
          d: '폴더로 묶어 정리하고, 이름·아이디·폴더 이름으로 찾습니다. 목록 화면도 한 화면으로 바뀌었습니다' },
        { k: 'new', t: '도형 아래를 흐리게 가리는 가림막',
          d: '사각형·원 도형에 켜면 아래 내용이 흐려집니다(세기 2~20). 내보낸 PNG 에는 흐림이 그대로 나오고, 목업 캡처·썸네일처럼 흐림을 못 그리는 자리에서는 진한 회색으로 채워 가린 내용이 드러나지 않습니다. «모자이크»는 당분간 막아 두어 흐림만 쓰실 수 있습니다' },
        { k: 'new', t: '도형·이미지도 섹션 위에 띄우기',
          d: '«오버레이로 전환» 이 글자 블럭 밖으로 넓어졌습니다' },
        { k: 'new', t: '모서리로 크기 조절이 넓어짐',
          d: '그리드 칸 안 이미지·아이콘과, 오버레이로 띄운 글자도 모서리를 끌어 키웁니다' },
        { k: 'imp', t: '캔버스에서 그라데이션 직접 조절',
          d: '선 위 색칩을 끌어 색 위치를 바꾸고 끄는 동안 % 가 보입니다. 글자 그라데이션에도 조절 바가 뜹니다' },
        { k: 'fix', t: '바꾼 값이 저장 뒤 사라지던 문제',
          d: '배너·주석 블럭의 글자 크기·색이 저장하고 다시 열어도 그대로 남습니다' },
        { k: 'fix', t: '내보낸 PNG 에 안내문구·바둑판 무늬가 찍히던 문제',
          d: '배너 안내문구가 박히거나 이미지를 안 넣은 칸의 바둑판 무늬가 찍히지 않습니다. 다만 그리드 칸보다 긴 글자가 옆 칸 위에 찍히는 것은 아직 남아 있습니다 — 칸 폭에 맞춰 줄여 주세요' },
        { k: 'fix', t: '⌘Z 가 두 걸음씩 되돌아가던 문제',
          d: '새로 넣은 블럭을 손보고 되돌리면 블럭째 사라졌습니다. 이제 값만 되돌아갑니다' },
      ],
    },
    '0.9.3': {
      date: '2026-09-11',
      items: [
        { k: 'fix', t: '가입을 마치지 않은 계정이 그냥 들어와지던 문제',
          d: '구글로 로그인하면 이름·전화·약관 동의 없이도 편집기가 열렸습니다. 이제 추가 정보를 입력하고 다시 로그인하셔야 들어옵니다' },
        { k: 'fix', t: '그 상태에서 앱을 껐다 켜면 다시 들어와지던 문제',
          d: '가입이 끝나지 않은 계정은 로그인 정보를 저장하지 않습니다. 이미 쓰시던 계정은 그대로입니다' },
      ],
    },
    '0.9.2': {
      date: '2026-09-10',
      items: [
        { k: 'fix', t: '내보낸 파일에 「안 고른 시안」이 같이 실리던 문제',
          d: 'A/B 시안을 쓰면 HTML·Figma 에 두 개가 다 나갔습니다. 받는 분 화면에 고르지 않은 쪽이 같이 보였습니다' },
        { k: 'fix', t: '아이콘 창이 깨져 보일 때 「에러 문서」가 저장되던 문제',
          d: '아이콘 서버가 잠시 거절하면 그 안내 문서가 캔버스에 들어가 프로젝트에 남았습니다' },
        { k: 'fix', t: '링크 연결선이 캔버스 색에 묻히던 문제',
          d: '배경색에 맞춰 선 색을 고릅니다' },
        { k: 'fix', t: '링크된 섹션을 복사하면 링크가 겹치던 문제',
          d: '스크래치패드도 같이 복제되어 각각 하나씩 붙습니다' },
        { k: 'fix', t: '그리드블럭 텍스트를 골라도 우측 패널이 비어 있던 문제',
          d: '줄을 고르면 그 줄의 글꼴·색이 뜹니다' },
        { k: 'fix', t: 'g 를 눌러도 갭이 엉뚱한 자리에 붙던 문제',
          d: '모달·목업·조커 블록에서 섹션 맨 끝으로 갔습니다' },
        { k: 'new', t: '갭블럭 높이를 1000 까지',
          d: '전에는 400 이 한도였습니다' },
        { k: 'imp', t: '줌 이펙트 패널 정리',
          d: '벌림에 음수가 안 들어가고, A4(세로) 프리셋과 모서리 라디우스 핸들이 생겼습니다' },
        { k: 'new', t: '스티커를 코너 잡고 회전',
          d: '' },
        { k: 'new', t: '클로드앱에서 이미지를 「경로」로 넣기',
          d: '첨부한 그림을 블록에 바로 넣을 수 있습니다' },
      ],
    },
    '0.9.1': {
      date: '2026-09-07',
      items: [
        { k: 'new', t: '「듀오 블럭」이 「그리드 블럭」으로',
          d: '비율을 표에서 직접 지정 · 행 경계를 끌어 높이 조절 · 1열 구성 허용' },
        { k: 'imp', t: '캔버스 밀기가 부드러워짐',
          d: '스페이스 드래그를 기본 스크롤로 전환 · 미는 동안 자동저장을 미뤄 「탁」 걸리던 현상 제거' },
        { k: 'imp', t: '휠 줌이 배율과 상관없이 균일한 폭으로',
          d: '확대 상태에서 한 칸이 과하게 커지던 현상 해소 · 줌 뒤 노치 클릭이 빗나가던 것도 함께' },
        { k: 'fix', t: '저장이 실패했을 때 그대로 종료되던 문제',
          d: '종료를 멈추고 알림 · 비상 사본 자동 보관 (윈도우 X 버튼 포함)' },
        { k: 'fix', t: '선택 테두리가 이웃 블록에 가려지던 문제',
          d: '선택 표시를 별도 층에서 그리도록 재작성 · 카드 모서리 핸들 방향 정정' },
        { k: 'new', t: '오류 신고 창',
          d: '지난 실행에서 앱이 멈춘 기록을 되찾아 그대로 보낼 수 있음' },
        { k: 'fix', t: '클로드 MCP 연결 시 이미지·표·간격이 안 보이던 문제',
          d: '캔버스 읽기가 모든 블록 반환 · 이미지 전송 시 원본 손상 방지' },
        { k: 'new', t: '상단바에 현재 버전 표시',
          d: '문의 시 함께 알려주시면 확인이 빠릅니다' },
        { k: 'fix', t: '여러 블록 복사 시 순서가 뒤섞이던 문제',
          d: '고른 순서 그대로 붙여넣기 · 개수 제한 없음' },
        { k: 'fix', t: '스크래치 그룹 해제 후에도 섹션을 따라다니던 문제',
          d: '그룹 해제 시 섹션 연결도 함께 끊김' },
        { k: 'imp', t: '업데이트 후 남던 설치 파일 자동 정리',
          d: '맥 약 353MB · 윈도우 약 337MB 확보' },
      ],
    },
  };

  const GROUP = { new: '새로 생긴 것', fix: '고친 것', imp: '나아진 것' };


  function open(version, note) {
    const items = note.items || note;
    if (document.getElementById('relnote-modal')) return;   // 겹쳐 띄우지 않는다
    const overlay = document.createElement('div');
    overlay.id = 'relnote-modal';
    overlay.className = 'settings-modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="settings-modal-shell relnote-shell" role="dialog" aria-modal="true" aria-label="업데이트 내역">
        <div class="relnote-hero">
          <span class="tb-badge tb-badge--pill tb-badge--accent relnote-ver"></span>
          <div class="relnote-titlerow"><span class="relnote-h">릴리스 노트</span><span class="relnote-date"></span></div>
          <button class="settings-modal-close relnote-close" data-act="close" title="닫기 (Esc)">×</button>
        </div>
        <div class="relnote-list"></div>
        <div class="settings-modal-footer">
          <label class="relnote-off"><input type="checkbox" data-act="off"> 일주일간 안 보기</label>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-primary" data-act="ok">확인</button>
        </div>
      </div>`;
    overlay.querySelector('.relnote-ver').textContent = `버전 ${version}`;
    /* ★제목은 «항상 고정» — 릴리스노트지 카피라이팅이 아니다. 날짜는 제목과 같은 줄에. */
    overlay.querySelector('.relnote-date').textContent =
      'v' + version + (note.date ? ' · ' + note.date : '');
    overlay.querySelector('.relnote-shell').style.position = 'relative';

    /* ★textContent 로만 넣는다 — 노트가 HTML 로 실행될 이유가 없다(notice.js 와 같은 규약). */
    const list = overlay.querySelector('.relnote-list');
    let lastKind = null;
    items.forEach(it => {
      if (it.k !== lastKind) {                       // 종류가 바뀌면 그룹 제목을 세운다
        const g = document.createElement('div');
        g.className = 'relnote-group relnote-group--' + it.k;
        g.textContent = GROUP[it.k] || '';
        list.appendChild(g);
        lastKind = it.k;
      }
      const row = document.createElement('div');
      row.className = 'relnote-item';
      const b = document.createElement('b');
      /* ★불릿은 «실제 요소»다 — ::before 는 렌더된 자리를 잴 수 없어 공식에 기대게 되고 세 번 틀렸다.
         제목 <b> 안에 두면 그 줄의 행간을 그대로 타고, 재서 맞출 수도 있다. */
      const bullet = document.createElement('i'); bullet.className = 'relnote-bullet';
      b.append(bullet, document.createTextNode(it.t));
      row.appendChild(b);
      if (it.d) { const s2 = document.createElement('span'); s2.textContent = it.d; row.appendChild(s2); }
      list.appendChild(row);
    });

    document.body.appendChild(overlay);

    const finish = () => {
      /* ★「일주일간 안 보기」 — 영구 해제가 아니라 «기한»이다. 지나면 다시 뜬다. */
      if (overlay.querySelector('[data-act=off]')?.checked) {
        try { localStorage.setItem(KEY_OFF, String(Date.now() + 7 * 86400000)); } catch (_) {}
      }
      try { localStorage.setItem(KEY_SEEN, version); } catch (_) {}
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); finish(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ok' || act === 'close') finish();
      else if (e.target === overlay) finish();          // 바깥 클릭 = 닫기(긴급 공지가 아니다)
    });
  }

  async function boot() {
    let off = null, seen = null;
    try { off = localStorage.getItem(KEY_OFF); seen = localStorage.getItem(KEY_SEEN); } catch (_) {}
    if (off && Number(off) > Date.now()) return;          // 기한 안이면 안 뜬다
    if (off) { try { localStorage.removeItem(KEY_OFF); } catch (_) {} }   // 지났으면 해제
    const v = await (window.electronAPI?.getVersion?.() || Promise.resolve(null));
    if (!v) return;                                    // 버전을 모르면 아무것도 안 한다
    if (!seen) {                                       // 신규 설치 — 비교 대상이 없다
      try { localStorage.setItem(KEY_SEEN, v); } catch (_) {}
      return;
    }
    if (seen === v) return;                            // 같은 버전 재실행
    const items = NOTES[v];
    if (!items) {                     // 노트를 안 쓴 버전은 조용히 넘어간다
      try { localStorage.setItem(KEY_SEEN, v); } catch (_) {}
      return;
    }
    open(v, items);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
  else setTimeout(boot, 600);

  window._relnoteOpen = (v) => open(v || '0.9.1', NOTES[v || '0.9.1'] || NOTES['0.9.1']);  // 미리보기용
})();
