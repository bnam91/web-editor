#!/bin/zsh
# 머리 줄: 다른 레인 수 · load · free+inactive(MB) · swap — (아이맥 사본 · 제 레인 = LANE_TAG 를 «다른 앱»에서 뺌)
p=$(vm_stat | awk '/page size of/{print $8}'); f=$(vm_stat | awk '/Pages free/{gsub("\\.","",$3);print $3}'); i=$(vm_stat | awk '/Pages inactive/{gsub("\\.","",$3);print $3}')
fi=$(( (f + i) * p / 1048576 ))
pw=$(ps -axo command | grep -E "playwright test|run-unit\.mjs|node --test" | grep -vE "grep|zsh -c|bash -c" | grep -vc "lane-gate")
el=$(ps -axo command | grep -E "Electron.*(user-data-dir|udata-)" | grep -vE "grep" | grep -oE "udata-[A-Za-z0-9_-]+" | sort -u | grep -v "udata-${LANE_TAG:-lane}" | tr '\n' ' ')
echo "$1 $(date +%T) · 다른 레인 런 ${pw} · 다른 앱(udata) [${el}] · load $(sysctl -n vm.loadavg | tr -d '{}' | xargs) · free+inactive ${fi}MB · swap $(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+M).*free = ([0-9.]+M).*/used \1 free \2/')"
