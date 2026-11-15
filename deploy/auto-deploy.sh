#!/usr/bin/env bash
# 자동 배포: GitHub main 에 새 커밋이 있으면 받아서 도커로 다시 빌드한다.
# cron 이 5분마다 부른다(설치: bash deploy/install-auto-deploy.sh). 손으로 불러도 된다.
#
# 서버가 GitHub 로 '나가서' 확인하는 방식이라 보안 그룹에 GitHub IP 를 열거나
# SSH 키를 GitHub 에 맡길 필요가 없다. 새 커밋이 없으면 아무것도 하지 않는다.
#
# 시험용 환경변수: COMPOSE(기본 'sudo docker compose'), DOCKER(기본 'sudo docker'),
#                  HEALTH_URL(기본 http://127.0.0.1/health, 빈 값이면 건너뜀)
set -uo pipefail
cd "$(dirname "$0")/.."

COMPOSE=${COMPOSE:-"sudo docker compose"}
HEALTH_URL=${HEALTH_URL-"http://127.0.0.1/health"}
BRANCH=${BRANCH:-main}
log() { echo "[$(date '+%F %T')] $*"; }

# 이전 배포(빌드에 몇 분 걸림)가 아직 돌고 있으면 이번 차례는 건너뛴다.
# flock 이 없으면(Ubuntu 엔 기본으로 있음) 잠금만 빼고 진행 — 없다고 배포를 조용히 건너뛰면 안 된다
if command -v flock >/dev/null; then
  exec 9>/tmp/jobmatch50-deploy.lock
  flock -n 9 || exit 0
fi

if ! git fetch -q origin "$BRANCH"; then
  log "GitHub 확인 실패(네트워크?) — 다음 차례에 다시"; exit 1
fi
# 마지막으로 '배포에 성공한' 커밋과 비교한다(HEAD 와 비교하면 빌드 실패 뒤 다시 시도하지 않음)
STATE=.git/jobmatch50-deployed
[ -s "$STATE" ] || git rev-parse HEAD > "$STATE"   # 처음엔 지금 돌고 있는 코드를 배포된 것으로 본다
DEPLOYED=$(cat "$STATE")
REMOTE=$(git rev-parse "origin/$BRANCH")
[ "$DEPLOYED" = "$REMOTE" ] && exit 0       # 새 커밋 없음: 조용히 끝

log "새 커밋 ${DEPLOYED:0:7} -> ${REMOTE:0:7}: $(git log -1 --format=%s "$REMOTE")"
if ! git merge -q --ff-only "origin/$BRANCH"; then
  log "서버 코드가 GitHub 와 갈라져 자동으로 받을 수 없음(서버에서 직접 고친 파일?) — git status 확인 필요"; exit 1
fi

# 빌드가 실패하면 compose 는 기존 컨테이너를 그대로 두므로 사이트는 이전 버전으로 계속 돈다
if ! $COMPOSE up -d --build; then
  log "도커 빌드/실행 실패 — 이전 버전이 계속 서비스 중(다음 차례에 다시 시도)"; exit 1
fi
echo "$REMOTE" > "$STATE"
${DOCKER:-sudo docker} image prune -f >/dev/null 2>&1 || true   # 지난 빌드의 남은 이미지 정리(디스크 8GB라 꼭)

if [ -n "$HEALTH_URL" ]; then
  for _ in $(seq 1 12); do                   # 최대 1분 기다림
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then log "배포 완료 ${REMOTE:0:7}"; exit 0; fi
    sleep 5
  done
  log "배포는 했지만 /health 응답 없음 — docker compose logs 확인 필요"; exit 1
fi
log "배포 완료 ${REMOTE:0:7} (상태 확인 건너뜀)"
