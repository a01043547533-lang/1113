"""고용24 Open API 클라이언트.

두 API 모두 XML을 돌려주므로, 여기서는 '파싱해서 dict 리스트로 만드는 것'까지만 한다.
값의 정규화(급여·지역·날짜 등)는 app/cleaning 에서 담당한다.
"""
from __future__ import annotations

import time
import xml.etree.ElementTree as ET
from typing import Any

import httpx

from app.config import get_settings


class Work24Error(RuntimeError):
    pass


def _el_to_dict(el: ET.Element) -> dict[str, str]:
    """하위 태그들을 {tag: text} 로. 텍스트는 strip, None → ''."""
    return {child.tag: (child.text or "").strip() for child in el}


class _TTLCache:
    def __init__(self, ttl: int):
        self.ttl = ttl
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str):
        hit = self._store.get(key)
        if not hit:
            return None
        ts, val = hit
        if time.time() - ts > self.ttl:
            self._store.pop(key, None)
            return None
        return val

    def set(self, key: str, val: Any):
        self._store[key] = (time.time(), val)


_cache = _TTLCache(get_settings().CACHE_TTL)


async def _get_xml(url: str, params: dict[str, Any]) -> ET.Element:
    key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()) if k != "authKey")
    cached = _cache.get(key)
    if cached is not None:
        return cached
    s = get_settings()
    async with httpx.AsyncClient(timeout=s.HTTP_TIMEOUT) as client:
        r = await client.get(url, params=params)
    if r.status_code != 200:
        raise Work24Error(f"HTTP {r.status_code} from {url}")
    text = r.text.strip()
    if not text.startswith("<"):
        # 인증키 오류 등은 XML이 아닌 HTML/문자열로 오는 경우가 있다
        raise Work24Error(f"Non-XML response: {text[:200]}")
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        raise Work24Error(f"XML parse error: {e}") from e
    check_error(root)
    _cache.set(key, root)
    return root


def check_error(root: ET.Element) -> None:
    """고용24 에러 응답이면 Work24Error.

    실제로 본 형태:
    - <GO24><error>개인회원은 사용할 수 없는 OPEN-API입니다.</error></GO24>
    - <error><message>...</message></error>
    - <messageCd>...</messageCd>
    정상 응답처럼 보여서 '0건'으로 넘어가지 않게 여기서 막는다.
    """
    if root.tag.lower() == "error":
        msg = "".join(root.itertext()).strip()
    elif root.find("error") is not None:
        msg = "".join(root.find("error").itertext()).strip()
    elif root.find("messageCd") is not None:
        msg = "".join(root.itertext()).strip()
    else:
        return
    raise Work24Error(f"고용24 API 오류: {msg[:300]}")


# ---------------------------------------------------------------- 채용행사
# 일반 채용정보(210L01)는 기업회원 전용이라 개인 키로는 "개인회원은 사용할 수 없는 OPEN-API" 오류.
# 채용행사(210L11: 현장면접·일자리 수요데이·채용박람회)는 개인 키로 된다.
async def fetch_events(area_cd: str, display: int = 100) -> list[dict[str, str]]:
    s = get_settings()
    if not s.WORK24_JOB_KEY:
        raise Work24Error("WORK24_JOB_KEY 가 설정되지 않았습니다 (.env 확인)")
    params = {"authKey": s.WORK24_JOB_KEY, "callTp": "L", "returnType": "XML",
              "startPage": 1, "display": display, "areaCd": area_cd}
    root = await _get_xml(f"{s.WORK24_BASE}/wk/callOpenApiSvcInfo210L11.do", params)
    return parse_events_xml(root)


def parse_events_xml(root: ET.Element) -> list[dict[str, str]]:
    return [_el_to_dict(e) for e in root.findall("empEvent")]


async def fetch_event_detail(area_cd: str, event_no: str) -> dict[str, str]:
    """채용행사 상세(210D11). areaCd 를 같이 보내야 한다(없으면 '정보가 존재하지 않습니다')."""
    s = get_settings()
    params = {"authKey": s.WORK24_JOB_KEY, "callTp": "D", "returnType": "XML",
              "eventNo": event_no, "areaCd": area_cd}
    root = await _get_xml(f"{s.WORK24_BASE}/wk/callOpenApiSvcInfo210D11.do", params)
    return _el_to_dict(root)


# ---------------------------------------------------------------- 훈련과정
async def fetch_trainings(
    *,
    area1: str | None = None,
    ncs1: str | None = None,
    course_name: str | None = None,
    start_from: str,   # YYYYMMDD
    start_to: str,     # YYYYMMDD
    page: int = 1,
    page_size: int = 100,
    sort_col: str = "3",  # 3 = 취업률순
    sort: str = "DESC",
) -> tuple[int, list[dict[str, str]]]:
    """국민내일배움카드 훈련과정 목록(310L01). (총건수, 원본 dict 리스트) 반환."""
    s = get_settings()
    if not s.WORK24_TRAINING_KEY:
        raise Work24Error("WORK24_TRAINING_KEY 가 설정되지 않았습니다 (.env 확인)")
    params: dict[str, Any] = {
        "authKey": s.WORK24_TRAINING_KEY,
        "returnType": "XML",
        "outType": "1",
        "pageNum": page,
        "pageSize": min(page_size, 100),
        "srchTraStDt": start_from,
        "srchTraEndDt": start_to,
        "sort": sort,
        "sortCol": sort_col,
    }
    if area1:
        params["srchTraArea1"] = area1
    if ncs1:
        params["srchNcs1"] = ncs1
    if course_name:
        params["srchTraProcessNm"] = course_name

    root = await _get_xml(f"{s.WORK24_BASE}/hr/callOpenApiSvcInfo310L01.do", params)
    return parse_trainings_xml(root)


def parse_trainings_xml(root: ET.Element) -> tuple[int, list[dict[str, str]]]:
    total = int((root.findtext("scn_cnt") or "0").strip() or 0)
    container = root.find("srchList")
    nodes = container.findall("scn_list") if container is not None else root.findall(".//scn_list")
    return total, [_el_to_dict(n) for n in nodes]
