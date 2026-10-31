#!/usr/bin/env python3
"""touch-guard — 나무 무접촉 가드(시트 307). 런 앞·뒤로 찍어 «이름» 집합 차를 낸다. 표준 라이브러리만 · 나무에 안 쓴다.
재는 자 = tests/unit/touch-guard.test.mjs · 부르는 자 = tools/slots/touch-guard-slot.sh

  python3 -I tools/touch-guard.py snap <나무> <전.json>     런 앞
  python3 -I tools/touch-guard.py diff <나무> <전.json>     런 뒤 · rc 0 변경 0 / rc 1 변경 있음 / rc 2 못 쟀다(0 아님)
  python3 -I tools/touch-guard.py selftest <임시 자리>      한 쌍(양성 ⒜⒝⒞ · 음성 0건 · 한계 값)

보는 것: ⒤ 나무 폴더 자신의 mtime ⒥ 항목 이름 집합(정렬 · sha256 하나) ⒦ 항목 수 ＋ 항목별 종류·크기·mtime·링크 대상.
보는 범위(selftest 가 값으로 잰다): 심링크를 안 따라간다(링크 자신·대상 글자만) · 파일 내용을 안 읽는다(크기·mtime 그대로면 못 본다) ·
  넘겨준 나무 하나만 본다(다른 라이브 경로 안 봄) · 앞·뒤 두 점 사이만 본다(그 사이 생겼다 사라진 것은 못 본다).
"""
import hashlib, json, os, stat, sys

LIVE_FORBID = os.path.realpath(os.environ.get('TOUCH_GUARD_FORBID') or os.path.expanduser('~/web-editor'))
SHOW = 200


def _inside(path, root):
    return path == root or path.startswith(root.rstrip(os.sep) + os.sep)


def _kind(mode):
    return 'dir' if stat.S_ISDIR(mode) else 'link' if stat.S_ISLNK(mode) else 'file' if stat.S_ISREG(mode) else 'other'


def snap(tree):
    root = os.path.realpath(tree)
    if not os.path.isdir(root):
        raise SystemExit(f'[touch-guard] 나무가 폴더가 아니다: {tree}')
    errs, items = [], {}

    def walk(d):
        try:
            with os.scandir(d) as it:
                entries = list(it)
        except OSError as e:
            errs.append(f'{d}: {e}')
            return
        for e in entries:
            try:
                s = e.stat(follow_symlinks=False)
                rel = os.path.relpath(e.path, root).replace(os.sep, '/')
                k = _kind(s.st_mode)
                items[rel] = {'k': k, 'm': s.st_mtime_ns, 's': s.st_size if k != 'dir' else 0,
                              **({'t': os.readlink(e.path)} if k == 'link' else {})}
                if k == 'dir':
                    walk(e.path)
            except OSError as x:
                errs.append(f'{e.path}: {x}')

    walk(root)
    names = sorted(items)
    h = hashlib.sha256(b'\0'.join(os.fsencode(n) for n in names)).hexdigest()
    return {'root': root, 'rootMtimeNs': os.lstat(root).st_mtime_ns, 'namesSha256': h, 'count': len(names), 'items': items, 'errs': errs}


def compare(a, b):
    ai, bi = a['items'], b['items']
    added = sorted(set(bi) - set(ai))
    removed = sorted(set(ai) - set(bi))
    changed = sorted(n for n in set(ai) & set(bi) if ai[n] != bi[n])
    return {'added': added, 'removed': removed, 'changed': changed,
            'rootSame': a['rootMtimeNs'] == b['rootMtimeNs'], 'hashSame': a['namesSha256'] == b['namesSha256'], 'countSame': a['count'] == b['count']}


def is_clean(c):
    return not (c['added'] or c['removed'] or c['changed']) and c['rootSame'] and c['hashSame']


def report(a, b, c):
    print(f"[touch-guard] 나무 {b['root']}")
    print(f"⒤ 폴더 mtime 전 {a['rootMtimeNs'] // 10**9} 후 {b['rootMtimeNs'] // 10**9} · {'같음' if c['rootSame'] else '★다름'}")
    print(f"⒥ 이름 집합 sha256 전 {a['namesSha256'][:16]} 후 {b['namesSha256'][:16]} · {'같음' if c['hashSame'] else '★다름'}")
    print(f"⒦ 항목 수 전 {a['count']} 후 {b['count']} · {'같음' if c['countSame'] else '★다름'}")
    for label, key in (('더해짐', 'added'), ('지워짐', 'removed'), ('바뀜(종류·크기·mtime·링크 대상)', 'changed')):
        print(f'{label} {len(c[key])}')
        for n in c[key][:SHOW]:
            print(f'  {n}')
        if len(c[key]) > SHOW:
            print(f'  … {len(c[key]) - SHOW} 더')


def selftest(parent):
    base = os.path.realpath(parent)
    if _inside(base, LIVE_FORBID):
        raise SystemExit(f'[touch-guard] 라이브 안에 임시 나무를 못 만든다: {base}')
    t = os.path.join(base, f'tg-self-{os.getpid()}')
    os.makedirs(os.path.join(t, 'a', 'b'))
    outside = t + '-outside'
    os.makedirs(outside)

    def w(p, body='x', root=t):
        with open(os.path.join(root, p), 'w') as f:
            f.write(body)

    for p in ('one.txt', 'two.txt', 'a/three.txt', 'a/b/four.txt'):
        w(p)
    w('target.txt', 'x', outside)
    try:
        os.symlink(outside, os.path.join(t, 'lnk'))
    except (OSError, NotImplementedError) as e:  # 권한 없는 윈도우
        print(f'SKIP 심링크 칸 못 만듦: {e}')
    os.utime(t, (1, 1))  # 폴더 mtime 을 옛 값으로 — 바뀌면 바로 보이게
    bad = 0

    def case(name, act, want_clean, want):
        nonlocal bad
        a = snap(t)
        act()
        c = compare(a, snap(t))
        got = {k: c[k] for k in want}
        ok = is_clean(c) == want_clean and got == want
        bad += 0 if ok else 1
        print(f"{'OK ' if ok else 'BAD'} {name} · 변경 {'0건' if is_clean(c) else '있음'} · 더해짐 {c['added']} · 지워짐 {c['removed']} · 바뀜 {c['changed']} · ⒤{'같음' if c['rootSame'] else '다름'} ⒥{'같음' if c['hashSame'] else '다름'} ⒦{'같음' if c['countSame'] else '다름'}")

    case('음성 아무것도 안 바꿈', lambda: None, True, {'added': [], 'removed': [], 'changed': []})
    case('양성⒜ 새 파일 더하기', lambda: w('new.txt'), False, {'added': ['new.txt'], 'removed': []})
    case('양성⒝ 파일 지우기', lambda: os.remove(os.path.join(t, 'new.txt')), False, {'added': [], 'removed': ['new.txt']})
    case('양성⒞ 수 그대로 이름만(지우고 더하기)', lambda: (os.remove(os.path.join(t, 'two.txt')), w('two-b.txt')), False, {'added': ['two-b.txt'], 'removed': ['two.txt'], 'countSame': True})

    def deep():
        os.remove(os.path.join(t, 'a/b/four.txt'))
        w('a/b/five.txt')
    case('양성⒞깊이 하위 폴더에서 이름만 · 맨 위 ⒤ 그대로', deep, False, {'added': ['a/b/five.txt'], 'removed': ['a/b/four.txt'], 'countSame': True, 'rootSame': True})

    def md():
        w('a/three.txt', 'longer body')
    case('곁 내용·크기 바뀜(mtime 으로 봄)', md, False, {'added': [], 'removed': [], 'changed': ['a/three.txt']})

    def same_stat():
        p = os.path.join(t, 'one.txt')
        s = os.lstat(p)
        w('one.txt', 'y')
        os.utime(p, ns=(s.st_atime_ns, s.st_mtime_ns))
    case('한계 내용만 · 크기·mtime 그대로 ⇒ 못 본다', same_stat, True, {'added': [], 'removed': [], 'changed': []})
    case('한계 심링크 너머 더하기 ⇒ 안 따라간다', lambda: w('new-out.txt', 'x', outside), True, {'added': [], 'removed': [], 'changed': []})
    print(f'[selftest] 임시 나무 {t} · BAD {bad}')
    return 1 if bad else 0


def main(argv):
    sys.stdout.reconfigure(errors='backslashreplace')  # 파일 이름이 utf-8 이 아니어도 글 찍다 죽지 않게
    if len(argv) == 2 and argv[0] == 'selftest':
        return selftest(argv[1])
    if len(argv) != 3 or argv[0] not in ('snap', 'diff'):
        print(__doc__)
        return 2
    cmd, tree, f = argv
    cur = snap(tree)
    if cmd == 'snap':
        out = os.path.realpath(f)
        if _inside(out, cur['root']):
            print(f'[touch-guard] 찍은 값을 나무 안에 못 쓴다: {out}')
            return 2
        try:
            with open(out, 'x') as fh:
                json.dump(cur, fh)
        except FileExistsError:
            print(f'[touch-guard] 이미 있다(안 덮어쓴다): {out}')
            return 2
        print(f"[touch-guard] snap {cur['root']} · ⒤ {cur['rootMtimeNs'] // 10**9} · ⒥ {cur['namesSha256'][:16]} · ⒦ {cur['count']} · 못 읽음 {len(cur['errs'])} → {out}")
        return 2 if cur['errs'] else 0
    with open(f) as fh:
        before = json.load(fh)
    if before['root'] != cur['root']:
        print(f"[touch-guard] 다른 나무다: 전 {before['root']} ↔ 후 {cur['root']}")
        return 2
    if cur['errs'] or before['errs']:
        print(f"[touch-guard] 못 읽은 자리 전 {len(before['errs'])} 후 {len(cur['errs'])} — 0 이라 말할 수 없다: {(before['errs'] + cur['errs'])[:5]}")
        return 2
    c = compare(before, cur)
    report(before, cur, c)
    return 0 if is_clean(c) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
