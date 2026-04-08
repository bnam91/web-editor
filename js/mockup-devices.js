// Device Mockup — 디바이스 정의 (SVG 프레임 + 화면 좌표)
// 화면 좌표는 viewBox 기준 % (left, top, width, height)

export const MOCKUP_DEVICES = {
  iphone: {
    label: 'iPhone',
    // iPhone 14 Blue PNG (860×1738, RGBA) — PNG 오버레이 방식
    viewW: 860, viewH: 1738,
    defaultWidth: 240,
    screen: { l: 3.5, t: 2.5, w: 93.0, h: 94.9 },
    screenRadius: '8%',
    getSvg(_uid) {
      return `<img src="assets/iphone-14-blue.png" style="width:100%;height:100%;display:block;pointer-events:none;" draggable="false">`;
    }
  },

  macbook: {
    label: 'MacBook',
    viewW: 600, viewH: 400,
    defaultWidth: 420,
    screen: { l: 5.83, t: 3.75, w: 88.33, h: 81.25 },
    screenRadius: '2px',
    getSvg(uid) {
      return `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
        <defs>
          <mask id="mkp-m-${uid}">
            <rect x="20" y="0" width="560" height="355" rx="12" fill="white"/>
            <rect x="35" y="15" width="530" height="325" rx="4" fill="black"/>
          </mask>
        </defs>
        <!-- Lid with screen hole -->
        <rect x="20" y="0" width="560" height="355" rx="12" fill="#1c1c1e" mask="url(#mkp-m-${uid})"/>
        <rect x="20" y="0" width="560" height="355" rx="12" fill="none" stroke="#3a3a3c" stroke-width="1.5"/>
        <!-- Camera dot -->
        <circle cx="300" cy="8" r="3" fill="#3a3a3c"/>
        <!-- Hinge line -->
        <rect x="10" y="352" width="580" height="3" rx="1" fill="#111"/>
        <!-- Keyboard base -->
        <path d="M0 355 L10 352 L590 352 L600 355 L598 380 Q300 394 2 380 Z" fill="#2c2c2e"/>
        <path d="M0 355 L10 352 L590 352 L600 355 L598 380 Q300 394 2 380 Z" fill="none" stroke="#3a3a3c" stroke-width="1"/>
        <!-- Trackpad -->
        <rect x="230" y="360" width="140" height="18" rx="5" fill="#252527"/>
      </svg>`;
    }
  },

  ipad: {
    label: 'iPad',
    viewW: 350, viewH: 470,
    defaultWidth: 290,
    screen: { l: 5.71, t: 11.70, w: 88.57, h: 76.60 },
    screenRadius: '2px',
    getSvg(uid) {
      return `<svg viewBox="0 0 350 470" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
        <defs>
          <mask id="mkp-m-${uid}">
            <rect x="0" y="0" width="350" height="470" rx="24" fill="white"/>
            <rect x="20" y="55" width="310" height="360" rx="4" fill="black"/>
          </mask>
        </defs>
        <rect x="0" y="0" width="350" height="470" rx="24" fill="#1c1c1e" mask="url(#mkp-m-${uid})"/>
        <rect x="0" y="0" width="350" height="470" rx="24" fill="none" stroke="#3a3a3c" stroke-width="1.5"/>
        <!-- Front camera -->
        <circle cx="175" cy="28" r="5" fill="#2c2c2e"/>
        <!-- Home indicator -->
        <rect x="143" y="449" width="64" height="5" rx="2.5" fill="#3a3a3c"/>
        <!-- Side button -->
        <rect x="346" y="110" width="5" height="44" rx="2.5" fill="#2c2c2e"/>
        <!-- Volume -->
        <rect x="-1" y="120" width="4" height="28" rx="2" fill="#2c2c2e"/>
        <rect x="-1" y="156" width="4" height="28" rx="2" fill="#2c2c2e"/>
      </svg>`;
    }
  },

  android: {
    label: 'Android',
    viewW: 380, viewH: 820,
    defaultWidth: 220,
    screen: { l: 3.95, t: 9.76, w: 92.10, h: 80.49 },
    screenRadius: '8px',
    getSvg(uid) {
      return `<svg viewBox="0 0 380 820" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
        <defs>
          <mask id="mkp-m-${uid}">
            <rect x="0" y="0" width="380" height="820" rx="40" fill="white"/>
            <rect x="15" y="80" width="350" height="660" rx="30" fill="black"/>
          </mask>
        </defs>
        <rect x="0" y="0" width="380" height="820" rx="40" fill="#1c1c1e" mask="url(#mkp-m-${uid})"/>
        <rect x="0" y="0" width="380" height="820" rx="40" fill="none" stroke="#3a3a3c" stroke-width="1.5"/>
        <!-- Punch-hole camera -->
        <circle cx="190" cy="42" r="7" fill="#000"/>
        <!-- Home indicator -->
        <rect x="150" y="782" width="80" height="5" rx="2.5" fill="#3a3a3c"/>
        <!-- Side buttons -->
        <rect x="-2" y="200" width="4" height="40" rx="2" fill="#2c2c2e"/>
        <rect x="-2" y="248" width="4" height="62" rx="2" fill="#2c2c2e"/>
        <rect x="378" y="215" width="4" height="62" rx="2" fill="#2c2c2e"/>
      </svg>`;
    }
  },

  browser: {
    label: 'Browser',
    viewW: 800, viewH: 540,
    defaultWidth: 520,
    screen: { l: 0, t: 10.19, w: 100, h: 89.81 },
    screenRadius: '0',
    getSvg(uid) {
      return `<svg viewBox="0 0 800 540" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
        <defs>
          <mask id="mkp-m-${uid}">
            <rect x="0" y="0" width="800" height="540" rx="10" fill="white"/>
            <rect x="0" y="55" width="800" height="485" fill="black"/>
          </mask>
        </defs>
        <!-- Window shell with title-bar hole -->
        <rect x="0" y="0" width="800" height="540" rx="10" fill="#ddd" mask="url(#mkp-m-${uid})"/>
        <rect x="0" y="0" width="800" height="540" rx="10" fill="none" stroke="#bbb" stroke-width="1.5"/>
        <!-- Divider -->
        <rect x="0" y="54" width="800" height="2" fill="#c8c8c8"/>
        <!-- Traffic lights -->
        <circle cx="22" cy="27" r="7" fill="#ff5f56"/>
        <circle cx="46" cy="27" r="7" fill="#ffbd2e"/>
        <circle cx="70" cy="27" r="7" fill="#27c93f"/>
        <!-- URL bar -->
        <rect x="150" y="12" width="420" height="28" rx="14" fill="#f5f5f5"/>
        <text x="360" y="30" text-anchor="middle" font-size="11" fill="#999" font-family="-apple-system,sans-serif">example.com</text>
        <!-- Reload button -->
        <text x="126" y="31" text-anchor="middle" font-size="14" fill="#aaa" font-family="sans-serif">↻</text>
      </svg>`;
    }
  }
};

window.MOCKUP_DEVICES = MOCKUP_DEVICES;
