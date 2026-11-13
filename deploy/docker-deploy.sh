#!/usr/bin/env bash
# EC2(Ubuntu)에서 도커로 배포/갱신:  bash deploy/docker-deploy.sh
# 처음: 저장소를 받은 뒤 backend/.env 에 인증키를 넣고 실행. 이후 코드가 바뀌면 다시 실행하면 된다.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

# 메모리 1GB 인스턴스는 프런트 빌드 중 멈출 수 있어 스왑 2GB
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo ">>> backend/.env 에 인증키를 넣은 뒤 다시 실행하세요"; exit 1
fi

git pull --ff-only || true
sudo docker compose up -d --build
sudo docker image prune -f >/dev/null
sleep 5
curl -fsS http://127.0.0.1/health && echo "  <- 배포 완료"
