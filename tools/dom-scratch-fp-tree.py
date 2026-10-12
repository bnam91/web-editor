#!/usr/bin/env python3
"""★`phys_footprint_peak` 를 ★내 자손마다 모아 합한다 — ★server-manager 가 N 을 정할 ★주 자.
   ★까닭: RSS 는 ★압축기가 ★살아 있는 채로 ★빼 간다(실측 83,792KB → 7,152KB) ⇒ ★★가장 눌릴 때 ★덜 발동한다.
          `phys_footprint_peak` 는 ★peak 이라 ★표본 주기에 ★안 흔들린다(실측 6표본 전부 85MB)."""
import subprocess, sys, re
def descendants(root):
    out = subprocess.run(['ps','-eo','pid=,ppid='],capture_output=True,text=True).stdout
    kids={}
    for l in out.splitlines():
        f=l.split()
        if len(f)>=2:
            try: p,pp=int(f[0]),int(f[1])
            except ValueError: continue
            kids.setdefault(pp,[]).append(p)
    seen=set(); st=[root]; res=[]
    while st:
        q=st.pop()
        if q in seen: continue
        seen.add(q); res.append(q); st.extend(kids.get(q,[]))
    return res
UNIT={'KB':1/1024.0,'MB':1.0,'GB':1024.0,'K':1/1024.0,'M':1.0,'G':1024.0}
def peak_mb(pid):
    try:
        o=subprocess.run(['footprint','-p',str(pid)],capture_output=True,text=True,timeout=8).stdout
    except Exception: return None
    m=re.search(r'phys_footprint_peak:\s*([\d.]+)\s*([KMG]B?)',o)
    if not m: return None
    return float(m.group(1))*UNIT.get(m.group(2),1.0)
if __name__=='__main__':
    root=int(sys.argv[1])
    rows=[]
    for p in descendants(root):
        v=peak_mb(p)
        if v is not None: rows.append((v,p))
    rows.sort(reverse=True)
    tot=sum(v for v,_ in rows)
    top=' '.join('%d:%.0fMB'%(p,v) for v,p in rows[:3])
    print("%.1f %d %s" % (tot, len(rows), top if top else '-'))
