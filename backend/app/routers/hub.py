"""시·도 + 관심 분야 → 시험(자격증)·훈련·취업·알바를 한 번에."""
from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query

from app.cleaning.events import clean_event, upcoming
from app.cleaning.qnet import clean_schedule, clean_venues, parse_fee, training_keyword
from app.cleaning.training import clean_training, dedupe_trainings
from app.clients.qnet import fetch_fee, fetch_jm_list, fetch_jm_schedule, fetch_venues
from app.clients.work24 import fetch_event_detail, fetch_events, fetch_trainings
from app.codes import PRESETS, SIDO, SIDO_BRANCHES, SIDO_EVENT_AREA

router = APIRouter(prefix="/api", tags=["hub"])
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
QNET_CERT_URL = "https://www.q-net.or.kr/crf005.do?id=crf00505&jmCd={}"


# ------------------------------------------------------------------ 공통
@lru_cache
def stats() -> dict:
    files = sorted(DATA_DIR.glob("qnet_stats_*.json"))
    if not files:
        raise RuntimeError("app/data/qnet_stats_YYYY.json 이 없습니다. python -m app.build_stats --year 2025")
    return json.loads(files[-1].read_text(encoding="utf-8"))


def _check(sido: str, preset: str | None = None):
    if sido not in SIDO:
        raise HTTPException(400, f"지원하지 않는 시·도: {sido}")
    if preset is not None and preset not in PRESETS:
        raise HTTPException(400, f"지원하지 않는 분야: {preset}")


async def _safe(coro, label: str):
    try:
        return await coro
    except Exception as e:  # 한 영역이 실패해도 나머지는 보여준다
        return {"error": f"{label}: {type(e).__name__}: {e}"}


async def _trainings(sido: str, keyword: str, today: date, limit: int = 30) -> dict:
    total, raw = await fetch_trainings(
        area1=SIDO[sido][1], course_name=keyword,
        start_from=today.strftime("%Y%m%d"), start_to=(today + timedelta(days=90)).strftime("%Y%m%d"),
        page_size=100,
    )
    items = dedupe_trainings([clean_training(r, today) for r in raw])
    items = [t for t in items if "already_started" not in t.quality_flags]
    items.sort(key=lambda t: -t.score)
    return {"keyword": keyword, "total": total, "count": len(items), "items": [t.to_dict() for t in items[:limit]]}


# ------------------------------------------------------------------ 메타
@router.get("/meta")
def meta():
    st = stats()
    return {"sido": list(SIDO.keys()), "presets": list(PRESETS.keys()), "stats_year": st["year"]}


# ------------------------------------------------------------------ 시험: 지역 순위
def ranking(sido: str, preset: str | None, limit: int = 10) -> list[dict]:
    st = stats()
    local = st["by_sido"].get(sido, {})
    total = sum(local.values()) or 1
    nat_rank = {n: i + 1 for i, n in enumerate(st["national"])}
    subs = set(PRESETS[preset]["subfields"]) if preset else None
    out = []
    for name, cnt in local.items():
        m = st["meta"].get(name, {})
        if subs is not None and m.get("subfield") not in subs:
            continue
        out.append({
            "name": name, "jmcd": m.get("jmcd"), "count": cnt, "share": round(cnt / total, 4),
            "always": name in st["always"], "field": m.get("subfield"),
            "national_rank": nat_rank.get(name),
        })
    out.sort(key=lambda x: -x["count"])
    for i, x in enumerate(out[:limit]):
        x["rank"] = i + 1
    return out[:limit]


async def _featured(codes: list[str]) -> list[dict]:
    if not codes:
        return []
    jm = {r["jmcd"]: r for r in await fetch_jm_list()}
    return [{"name": jm[c]["jmfldnm"], "jmcd": c, "kind": jm[c].get("qualgbnm")} for c in codes if c in jm]


# ------------------------------------------------------------------ 취업: 채용행사 + 바로가기
async def _events(sido: str, today: date, limit: int = 6) -> dict:
    area = SIDO_EVENT_AREA[sido]
    rows = upcoming(await fetch_events(area), today)
    rows += upcoming(await fetch_events("57"), today)          # 전국 행사
    rows = sorted(rows, key=lambda r: r.get("startDt", ""))[:limit]

    async def detail(r):
        try:
            return await fetch_event_detail(r.get("areaCd") or area, r["eventNo"])
        except Exception:
            return None
    details = await asyncio.gather(*(detail(r) for r in rows))
    items = [clean_event(r, d, today) for r, d in zip(rows, details)]
    items.sort(key=lambda e: (not e.senior, e.date or date.max))
    return {"area": rows[0].get("area") if rows else None, "items": [e.to_dict() for e in items]}


def links(sido: str, job_kw: str, alba_kw: str) -> dict:
    j = quote(f"{sido} {job_kw}")
    a = quote(f"{sido} {alba_kw}")
    return {
        "jobs": [
            {"site": "고용24", "url": f"https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do?srcKeyword={j}", "note": "정부 일자리 포털"},
            {"site": "노인일자리 여기", "url": "https://www.seniorro.or.kr", "note": "시니어 구인 (첫 화면으로 이동)"},
            {"site": "사람인", "url": f"https://www.saramin.co.kr/zf_user/search?searchword={j}", "note": None},
            {"site": "잡코리아", "url": f"https://www.jobkorea.co.kr/Search/?stext={j}", "note": None},
        ],
        "alba": [
            {"site": "알바몬", "url": f"https://www.albamon.com/total-search?keyword={a}", "note": None},
            {"site": "당근알바", "url": f"https://jobs.daangn.com/s?query={a}", "note": "동네 알바"},
            {"site": "알바천국", "url": "https://www.alba.co.kr", "note": "첫 화면으로 이동"},
            {"site": "벼룩시장", "url": "https://www.findjob.co.kr", "note": "첫 화면으로 이동"},
        ],
    }


# ------------------------------------------------------------------ 허브
@router.get("/hub")
async def hub(
    sido: str = Query(..., description="시·도, 예: 대구"),
    preset: str = Query(..., description="관심 분야, 예: 조리·제과제빵"),
):
    _check(sido, preset)
    p = PRESETS[preset]
    today = date.today()
    trainings, events, featured = await asyncio.gather(
        _safe(_trainings(sido, p["train"], today), "훈련과정"),
        _safe(_events(sido, today), "채용행사"),
        _safe(_featured(p["certs"]), "자격 목록"),
    )
    st = stats()
    return {
        "query": {"sido": sido, "preset": preset},
        "exams": {
            "year": st["year"], "grade": st["grade"],
            "ranking": ranking(sido, preset),
            "featured": featured if isinstance(featured, list) else [],
            "external": p["external"],
        },
        "trainings": trainings,
        "events": events,
        "links": links(sido, p["job"], p["alba"]),
    }


# ------------------------------------------------------------------ 자격증 상세
@router.get("/cert/{jmcd}")
async def cert(jmcd: str, sido: str = Query(...)):
    _check(sido)
    jm = {r["jmcd"]: r for r in await fetch_jm_list()}
    if jmcd not in jm:
        raise HTTPException(404, "없는 종목 코드입니다")
    info = jm[jmcd]
    name = info["jmfldnm"]
    today = date.today()

    async def venues():
        rows = []
        for code in SIDO_BRANCHES[sido]:
            rows += await fetch_venues(code)
        return [v.__dict__ for v in clean_venues(rows, sido)]

    sched, fee, ven, trn = await asyncio.gather(
        _safe(fetch_jm_schedule(jmcd), "시험일정"),
        _safe(fetch_fee(jmcd), "응시료"),
        _safe(venues(), "시험장"),
        _safe(_trainings(sido, training_keyword(name), today, limit=12), "훈련과정"),
    )
    st = stats()
    local = st["by_sido"].get(sido, {})
    local_rank = {n: i + 1 for i, n in enumerate(local)}
    return {
        "jmcd": jmcd,
        "name": name,
        "kind": info.get("qualgbnm"),
        "series": info.get("seriesnm"),
        "field": info.get("mdobligfldnm"),
        "always": name in st["always"],
        "qnet_url": QNET_CERT_URL.format(jmcd),
        "stats": {"year": st["year"], "count": local.get(name), "rank": local_rank.get(name),
                  "national": st["national"].get(name)},
        "rounds": sched if isinstance(sched, dict) else [r.to_dict() for r in clean_schedule(sched, today)],
        "fee": fee if isinstance(fee, dict) and "error" in fee else parse_fee(fee),
        "venues": ven,
        "trainings": trn,
    }
