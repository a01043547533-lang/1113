#!/usr/bin/env bash
# 자동 배포 켜기(서버에서 한 번만):  bash deploy/install-auto-deploy.sh
# 5분마다 deploy/auto-deploy.sh 를 실행하는 cron 을 등록하고, 지금 한 번 바로 배포한다.
# 끄기:  crontab -l | grep -v auto-deploy.sh | crontab -
# 기록:  tail -f ~/jobmatch50-deploy.log
set -euo pipefail
cd "$(dirname "$0")/.."
APP=$(pwd)
LOG="$HOME/jobmatch50-deploy.log"
LINE="*/5 * * * * /bin/bash $APP/deploy/auto-deploy.sh >> $LOG 2>&1"

if [ ! -f backend/.env ]; then
  echo ">>> backend/.env(인증키)가 없습니다. 먼저 bash deploy/docker-deploy.sh 로 처음 배포를 하세요"; exit 1
fi

# 같은 줄이 있으면 바꾸고, 없으면 추가(여러 번 실행해도 한 줄만 남음)
# (crontab 이 아직 없으면 'crontab -l' 이 실패하고, 남길 줄이 없으면 grep 이 실패한다 — pipefail 에 걸리지 않게 || true)
( crontab -l 2>/dev/null | grep -v 'deploy/auto-deploy.sh' || true ; echo "$LINE" ) | crontab -
echo "자동 배포 켬: 5분마다 GitHub main 을 확인합니다 (기록: $LOG)"
crontab -l | grep auto-deploy.sh

# 지금 바로 한 번: 새 커밋이 있으면 배포, 없으면 그대로
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "새 커밋이 있어 지금 배포합니다(3~5분)…"
  bash deploy/auto-deploy.sh | tee -a "$LOG"
else
  echo "이미 최신입니다. 다음부터는 GitHub 에 올리면 5분 안에 자동으로 배포됩니다."
fi
