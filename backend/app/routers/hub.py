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
from app.cleaning.senuri import clean_agencies, clean_job, is_open, pick
from app.cleaning.training import clean_training, dedupe_trainings
from app.clients.qnet import fetch_fee, fetch_jm_list, fetch_jm_schedule, fetch_venues
from app.clients.senuri import fetch_agencies, fetch_job_detail, fetch_jobs
from app.clients.work24 import fetch_event_detail, fetch_events, fetch_trainings
from app.codes import PRESETS, SIDO, SIDO_BRANCHES, SIDO_EVENT_AREA
from app import freshness
from app.config import get_settings

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


@router.get("/status")
def status():
    """출처별 마지막 갱신 시각. 화면 아래 '데이터 갱신 현황'에 쓴다."""
    from datetime import datetime, timezone
    st = stats()
    files = sorted(DATA_DIR.glob("qnet_stats_*.json"))
    built = st.get("built_at") or datetime.fromtimestamp(files[-1].stat().st_mtime, timezone.utc).isoformat(timespec="seconds")
    items = [{
        "key": "qnet_stats", "name": "자격증 응시자 순위", "org": "한국산업인력공단 Q-Net",
        "cycle": "1년에 한 번", "ttl_min": 60 * 24 * 400, "updated_at": built,
        "note": f"{st['year']}년 {st['grade']} 접수 {st['rows']:,}건 집계",
    }]
    for key, (name, org, cycle) in freshness.SOURCES.items():
        if key == "qnet_list":
            continue
        t = freshness.last(key)
        n = freshness.note(key)
        if key in ("senior_jobs", "agencies") and not get_settings().DATA_GO_KR_KEY:
            n = "공공데이터포털 인증키가 없어 받지 않습니다"
        items.append({"key": key, "name": name, "org": org, "cycle": cycle, "ttl_min": freshness.TTL_MIN.get(key),
                      "updated_at": t.isoformat(timespec="seconds") if t else None, "note": n})
    return {"now": datetime.now(timezone.utc).isoformat(timespec="seconds"), "items": items}


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


async def _senior_jobs(sido: str, keywords: list[str], today: date, limit: int = 40, detail_n: int = 12) -> dict:
    """노인 구인정보.

    실측: 접수 중인 공고는 전국 약 260건이고 모두 최신 1,000건 안에 있다(2쪽부터는 전부 마감).
    그래서 최신 1,000건을 1시간 캐시로 한 번만 받아 모든 분야가 나눠 쓰고,
    지역 공고를 전부 보여주되 관심 분야 검색어가 제목에 있는 공고를 위로 올린다.
    """
    if not get_settings().DATA_GO_KR_KEY:
        return {"error": "DATA_GO_KR_KEY 미설정", "items": []}
    latest = await fetch_jobs(None, 1000)
    rows = pick(latest, sido, today)
    match = {r["jobId"] for r in rows if any(k in r.get("recrtTitle", "") for k in keywords)}
    rows.sort(key=lambda r: r["jobId"] not in match)          # 안정 정렬: 관심 분야 먼저, 그 안은 최신순

    async def detail(r):
        try:
            return await fetch_job_detail(r["jobId"])
        except Exception:
            return None
    head = rows[:detail_n]
    details = await asyncio.gather(*(detail(r) for r in head))
    items = [clean_job(r, d, today) for r, d in zip(head, details)]
    items += [clean_job(r, None, today) for r in rows[detail_n:limit]]
    out = []
    for j in items:
        d = j.to_dict()
        d["match"] = j.id in match
        out.append(d)
    out.sort(key=lambda d: (not d["match"], not d["senior_pref"]))
    newest = max((r.get("frDd", "") for r in latest), default="")
    if len(newest) == 8:
        freshness.set_note("senior_jobs", f"가장 최근 공고 {int(newest[4:6])}월 {int(newest[6:8])}일 등록 · 전국 접수 중 "
                                          f"{sum(1 for r in latest if is_open(r, today))}건")
    return {"keywords": keywords, "count": len(rows), "match_count": len(match), "items": out,
            "national_open": sum(1 for r in latest if is_open(r, today)),
            "newest": f"{newest[:4]}-{newest[4:6]}-{newest[6:8]}" if len(newest) == 8 else None}


async def _agencies(sido: str) -> dict:
    if not get_settings().DATA_GO_KR_KEY:
        return {"error": "DATA_GO_KR_KEY 미설정", "items": []}
    items = clean_agencies(await fetch_agencies(), sido)
    return {"count": len(items), "items": [a.__dict__ for a in items]}


def links(sido: str, job_kw: str, alba_kw: str) -> dict:
    """같은 조건 검색 바로가기. icon 은 frontend/public/favicons/{icon}.png (한 번 받아 둔 각 사이트 파비콘).

    당근알바는 검색어에 지역을 넣어도 브라우저에 설정된 '내 동네'(regionId)로 열린다
    (2026-11-13 확인: 부산으로 찾아도 대구 동네가 뜸). 시·도 → regionId 공개 목록이 없어
    검색어만 넘기고, 화면에서 동네를 바꾸도록 안내한다.
    """
    j = quote(f"{sido} {job_kw}")
    a = quote(f"{sido} {alba_kw}")
    return {
        "jobs": [
            {"site": "고용24", "icon": "work24", "url": f"https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do?srcKeyword={j}", "note": "정부 일자리 포털"},
            {"site": "노인일자리 여기", "icon": "seniorro", "url": "https://www.seniorro.or.kr", "note": "시니어 구인 · 첫 화면으로 이동"},
            {"site": "사람인", "icon": "saramin", "url": f"https://www.saramin.co.kr/zf_user/search?searchword={j}", "note": f"‘{sido} {job_kw}’ 검색"},
            {"site": "잡코리아", "icon": "jobkorea", "url": f"https://www.jobkorea.co.kr/Search/?stext={j}", "note": f"‘{sido} {job_kw}’ 검색"},
        ],
        "alba": [
            {"site": "알바몬", "icon": "albamon", "url": f"https://www.albamon.com/total-search?keyword={a}", "note": f"‘{sido} {alba_kw}’ 검색"},
            {"site": "당근알바", "icon": "daangn", "url": f"https://jobs.daangn.com/s?query={quote(alba_kw)}",
             "note": f"지금 설정된 동네로 열려요 · 동네를 {sido}로 바꿔 보세요"},
            {"site": "알바천국", "icon": "alba", "url": "https://www.alba.co.kr", "note": "첫 화면으로 이동"},
            {"site": "벼룩시장", "icon": "findjob", "url": "https://www.findjob.co.kr", "note": "첫 화면으로 이동"},
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
    trainings, events, featured, senior, agencies = await asyncio.gather(
        _safe(_trainings(sido, p["train"], today), "훈련과정"),
        _safe(_events(sido, today), "채용행사"),
        _safe(_featured(p["certs"]), "자격 목록"),
        _safe(_senior_jobs(sido, p["senior"], today), "노인 구인정보"),
        _safe(_agencies(sido), "노인일자리 수행기관"),
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
        "senior_jobs": senior,
        "agencies": agencies,
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
