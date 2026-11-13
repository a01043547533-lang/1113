#!/usr/bin/env bash
# EC2(Ubuntu 22.04/24.04) 처음 한 번 실행:  bash deploy/setup.sh
set -euo pipefail
APP=/home/ubuntu/jobmatch50

sudo apt-get update
sudo apt-get install -y python3-venv python3-pip nginx git curl rsync

# Node 20 (프런트 빌드용)
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# t2.micro/t3.micro 는 메모리가 1GB라 npm 빌드가 죽을 수 있어 스왑 2GB 추가
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

cd "$APP/backend"
python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">>> backend/.env 에 인증키를 넣은 뒤 다시 실행하세요:  nano $APP/backend/.env"
  exit 1
fi

sudo cp "$APP/deploy/jobmatch50.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable jobmatch50

sudo cp "$APP/deploy/nginx.conf" /etc/nginx/sites-available/jobmatch50
sudo ln -sf /etc/nginx/sites-available/jobmatch50 /etc/nginx/sites-enabled/jobmatch50
sudo rm -f /etc/nginx/sites-enabled/default

bash "$APP/deploy/update.sh"
