"""한국노인인력개발원 OPEN-API (공공데이터포털, DATA_GO_KR_KEY 필요).

- SenuriService/getJobList     노인 구인정보 목록 (노인일자리 여기 + 워크넷 연계, 누적 약 76만 건, 최신순)
- SenuriService/getJobInfo     구인정보 상세 (id=jobId)
- JobBsnInfoService/getJobOperInsttList   노인일자리 수행기관 목록 (약 1,460곳, 전화번호는 가려져 옴)

2026-11-13 실측:
- 목록의 search(검색어)·emplymShp(고용형태) 필터는 동작, workPlc(근무지)·jobcls(직종) 필터는 동작하지 않음
- workPlc 앞 두 자리 = 회사 소재지 시·도 (cleaning/senuri.py 참고)
"""
from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from typing import Any

import httpx

from app.clients.work24 import _TTLCache
from app import freshness
from app.config import get_settings

BASE = "https://apis.data.go.kr/B552474"


class SenuriError(RuntimeError):
    pass


_cache = _TTLCache(60 * 60)          # 목록·상세 1시간
_cache_day = _TTLCache(60 * 60 * 24)  # 수행기관 하루


def parse(root: ET.Element) -> tuple[int, list[dict[str, str]]]:
    if root.tag == "OpenAPI_ServiceResponse":   # 공공데이터포털 게이트웨이 오류(키 문제 등)
        raise SenuriError(f"공공데이터포털 오류: {root.findtext('.//returnAuthMsg') or root.findtext('.//errMsg')}")
    code = (root.findtext("header/resultCode") or "").strip()
    if code and code != "00":
        raise SenuriError(f"API 오류 {code}: {root.findtext('header/resultMsg')}")
    total = int((root.findtext(".//totalCount") or "0").strip() or 0)
    items = [{c.tag: (c.text or "").strip() for c in it} for it in root.findall(".//item")]
    return total, items


async def _get(path: str, cache: _TTLCache, **params: Any) -> tuple[int, list[dict[str, str]]]:
    key = get_settings().DATA_GO_KR_KEY
    if not key:
        raise SenuriError("DATA_GO_KR_KEY 가 설정되지 않았습니다 (.env 확인)")
    ck = path + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    hit = cache.get(ck)
    if hit is not None:
        return hit
    for attempt in range(2):   # 연결이 끊기면 한 번 더 시도
        try:
            async with httpx.AsyncClient(timeout=get_settings().HTTP_TIMEOUT + 15) as client:
                r = await client.get(f"{BASE}/{path}", params={"serviceKey": key, **params})
            break
        except httpx.HTTPError:
            if attempt == 1:
                raise
            await asyncio.sleep(0.8)
    text = r.text.strip()
    if not text.startswith("<"):
        raise SenuriError(f"HTTP {r.status_code}: {text[:200]}")
    try:
        out = parse(ET.fromstring(text))
    except ET.ParseError as e:
        raise SenuriError(f"XML parse error: {e}") from e
    cache.set(ck, out)
    freshness.mark("senior_jobs" if path.startswith("SenuriService") else "agencies")
    return out


async def fetch_jobs(search: str | None = None, rows: int = 1000, page: int = 1) -> list[dict[str, str]]:
    params: dict[str, Any] = {"pageNo": page, "numOfRows": rows}
    if search:
        params["search"] = search
    return (await _get("SenuriService/getJobList", _cache, **params))[1]


async def fetch_job_detail(job_id: str) -> dict[str, str]:
    items = (await _get("SenuriService/getJobInfo", _cache, id=job_id))[1]
    return items[0] if items else {}


async def fetch_agencies() -> list[dict[str, str]]:
    total, items = await _get("JobBsnInfoService/getJobOperInsttList", _cache_day, pageNo=1, numOfRows=1000)
    page = 2
    while len(items) < total and page <= 5:
        items += (await _get("JobBsnInfoService/getJobOperInsttList", _cache_day, pageNo=page, numOfRows=1000))[1]
        page += 1
    return items
