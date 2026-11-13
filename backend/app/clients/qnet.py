"""한국산업인력공단(Q-Net) OPEN-API 클라이언트.

2026-11-13 실측: 아래 API는 인증키 없이도 정상 응답한다. 공공데이터포털 키(DATA_GO_KR_KEY)가
설정돼 있으면 함께 보낸다(나중에 키 검사가 켜져도 그대로 동작하도록).

- InquiryListNationalQualifcationSVC/getList      국가자격 종목 목록 (613개, 종목코드 jmcd)
- InquiryTestInformationNTQSVC/getJMList?jmCd=    종목별 시험일정 (상시 시험 포함)
- InquiryTestInformationNTQSVC/getFeeList?jmCd=   종목별 응시수수료
- InquiryExamAreaSVC/getList?brchCd=              지사별 시험장소
- InquiryExameeAbdSVC/getList?baseYY=&grdCd=      거주지별 기술자격 접수자 수 (연령대 정보는 없음)
"""
from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from typing import Any

import httpx

from app.clients.work24 import _TTLCache
from app import freshness
from app.config import get_settings

QNET = "http://openapi.q-net.or.kr/api/service/rest"


class QnetError(RuntimeError):
    pass


_cache = _TTLCache(60 * 60 * 6)  # 일정·종목·시험장은 자주 안 바뀐다


def _params(extra: dict[str, Any]) -> dict[str, Any]:
    key = get_settings().DATA_GO_KR_KEY
    return ({"serviceKey": key} if key else {}) | extra


def parse_items(root: ET.Element) -> list[dict[str, str]]:
    code = (root.findtext("header/resultCode") or "").strip()
    if code and code != "00":
        raise QnetError(f"Q-Net API 오류 {code}: {root.findtext('header/resultMsg')}")
    return [{c.tag: (c.text or "").strip() for c in it} for it in root.findall(".//item")]


async def get_items(path: str, **params: Any) -> list[dict[str, str]]:
    key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    hit = _cache.get(key)
    if hit is not None:
        return hit
    s = get_settings()
    # Q-Net은 가끔 '오류 99: Closed Connection'이나 연결 끊김을 낸다(2026-11-13 배포 서버에서 확인).
    # 다시 부르면 대부분 바로 정상이라 잠깐 쉬고 최대 3번까지 시도한다.
    last: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=s.HTTP_TIMEOUT) as client:
                r = await client.get(f"{QNET}/{path}", params=_params(params))
            if r.status_code != 200:
                raise QnetError(f"HTTP {r.status_code} from {path}")
            text = r.text.strip()
            if not text.startswith("<"):
                raise QnetError(f"Non-XML response: {text[:200]}")
            try:
                items = parse_items(ET.fromstring(text))
            except ET.ParseError as e:
                raise QnetError(f"XML parse error: {e}") from e
            break
        except (QnetError, httpx.HTTPError) as e:
            last = e
            if attempt == 2:
                raise
            await asyncio.sleep(0.6 * (attempt + 1))
    else:  # pragma: no cover
        raise last or QnetError("unknown")
    _cache.set(key, items)
    if path.startswith("InquiryTestInformationNTQSVC"):
        freshness.mark("qnet_schedule")
    elif path.startswith("InquiryExamAreaSVC"):
        freshness.mark("qnet_venues")
    elif path.startswith("InquiryListNationalQualifcationSVC"):
        freshness.mark("qnet_list")
    return items


async def fetch_jm_list() -> list[dict[str, str]]:
    return await get_items("InquiryListNationalQualifcationSVC/getList")


async def fetch_jm_schedule(jmcd: str) -> list[dict[str, str]]:
    return await get_items("InquiryTestInformationNTQSVC/getJMList", jmCd=jmcd)


async def fetch_fee(jmcd: str) -> list[dict[str, str]]:
    return await get_items("InquiryTestInformationNTQSVC/getFeeList", jmCd=jmcd)


async def fetch_venues(brch_cd: str) -> list[dict[str, str]]:
    return await get_items("InquiryExamAreaSVC/getList", brchCd=brch_cd, numOfRows=1000, pageNo=1)
