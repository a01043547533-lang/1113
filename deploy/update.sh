#!/usr/bin/env bash
# 코드 바뀔 때마다:  bash deploy/update.sh
set -euo pipefail
APP=/home/ubuntu/jobmatch50
cd "$APP"
git pull --ff-only

cd backend
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python -m pytest -q

cd ../frontend
npm ci --no-audit --no-fund
npm run build
sudo mkdir -p /var/www/jobmatch50
sudo rsync -a --delete dist/ /var/www/jobmatch50/

sudo systemctl restart jobmatch50
sudo nginx -t && sudo systemctl reload nginx
sleep 2
curl -fsS http://127.0.0.1/health && echo "  <- 배포 완료"
