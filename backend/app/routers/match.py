"""나이·지역·희망직종 → 채용공고 + 훈련과정을 한 번에."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.cleaning.jobs import clean_job, dedupe_jobs
from app.cleaning.training import clean_training, dedupe_trainings
from app.clients.work24 import Work24Error, fetch_jobs, fetch_trainings
from app.codes import JOB_PRESETS, NCS1, SIDO

router = APIRouter(prefix="/api", tags=["match"])


@router.get("/meta")
def meta():
    """프런트 드롭다운용 코드표."""
    return {
        "sido": list(SIDO.keys()),
        "presets": list(JOB_PRESETS.keys()),
        "ncs1": NCS1,
    }


@router.get("/match")
async def match(
    sido: str = Query(..., description="시도 표준명, 예: 대구"),
    preset: str | None = Query(None, description="희망직종 프리셋, 예: 요양보호사"),
    keyword: str | None = Query(None, description="프리셋 대신 직접 입력한 검색어"),
    age: int | None = Query(None, ge=15, le=99, description="나이(점수 계산·안내용, API 필터 아님)"),
    months_ahead: int = Query(3, ge=1, le=12, description="훈련 시작일 탐색 범위(개월)"),
    include_expired: bool = False,
):
    if sido not in SIDO:
        raise HTTPException(400, f"지원하지 않는 시도: {sido}")
    region_code, area1 = SIDO[sido]

    p = JOB_PRESETS.get(preset) if preset else None
    job_kw = "|".join(p["jobs_keywords"]) if p else (keyword or None)
    ncs1 = p["ncs1"] if p else None
    train_kw = p["train_keyword"] if p else (keyword or None)

    today = date.today()
    start_from = today.strftime("%Y%m%d")
    start_to = (today + timedelta(days=30 * months_ahead)).strftime("%Y%m%d")

    async def jobs_task():
        total, raw = await fetch_jobs(region=region_code, keyword=job_kw, display=100)
        cleaned = dedupe_jobs([clean_job(r, today) for r in raw])
        if not include_expired:
            cleaned = [j for j in cleaned if "expired" not in j.quality_flags]
        cleaned.sort(key=lambda j: (-j.senior_score, -(j.salary.monthly_min or 0)))
        return total, cleaned

    async def train_task():
        # NCS 분류와 과정명을 동시에 걸면 대부분 0건이 된다(실측: 대구 요양보호사 0건).
        # 그래서 과정명으로 먼저 찾고, 0건이면 NCS 대분류 전체로 넓힌다.
        common = dict(area1=area1, start_from=start_from, start_to=start_to, page_size=100)
        total, raw, mode = 0, [], None
        if train_kw:
            total, raw = await fetch_trainings(course_name=train_kw, **common)
            mode = "keyword"
        if total == 0 and ncs1:
            total, raw = await fetch_trainings(ncs1=ncs1, **common)
            mode = "ncs"
        cleaned = dedupe_trainings([clean_training(r, today) for r in raw])
        cleaned = [t for t in cleaned if "already_started" not in t.quality_flags]
        cleaned.sort(key=lambda t: -t.score)
        return total, cleaned, mode

    results = await asyncio.gather(jobs_task(), train_task(), return_exceptions=True)
    out = {"query": {"sido": sido, "preset": preset, "keyword": keyword, "age": age}, "jobs": {}, "trainings": {}}

    for key, res in zip(("jobs", "trainings"), results):
        if isinstance(res, Work24Error):
            out[key] = {"error": str(res), "items": [], "total": 0}
        elif isinstance(res, Exception):
            out[key] = {"error": f"{type(res).__name__}: {res}", "items": [], "total": 0}
        else:
            total, items, *rest = res
            out[key] = {"total": total, "count": len(items), "items": [i.to_dict() for i in items]}
            if rest:
                out[key]["match_mode"] = rest[0]
                if rest[0] == "ncs" and ncs1:
                    out[key]["notice"] = (
                        f"과정명에 '{train_kw}'이(가) 들어간 과정이 없어 "
                        f"'{NCS1.get(ncs1, ncs1)}' 분야 과정 전체를 보여드려요."
                    )

    # 중장년 대상 서비스라 나이를 따로 받지 않으면 기본으로 안내한다
    if age is None or age >= 50:
        out["notes"] = [
            "‘적합도’는 공고 제목과 경력·학력 조건을 보고 매긴 참고 점수예요. 공고에는 나이 조건을 적을 수 없거든요.",
            "훈련비 중 내가 내는 돈(자부담)은 카드 종류와 소득에 따라 달라요. 과정 상세 페이지에서 꼭 확인하세요.",
        ]
    return out
