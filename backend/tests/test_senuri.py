"""노인 구인정보·수행기관 정제 테스트. 픽스처는 2026-11-13 실제 응답(담당자 이름 제거)."""
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

import pytest

from app.cleaning.senuri import (WORK24_DETAIL, clean_agencies, clean_job, is_open, pick,
                                 sido_prefixes)
from app.clients.senuri import SenuriError, parse

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2026, 11, 13)


def items(name):
    return parse(ET.parse(FIX / name).getroot())[1]


def test_gateway_error_is_raised():
    root = ET.fromstring("<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</errMsg>"
                         "<returnAuthMsg>등록되지 않은 키</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>")
    with pytest.raises(SenuriError, match="등록되지 않은 키"):
        parse(root)


def test_sido_prefix_mapping():
    assert sido_prefixes("서울") == {"01"} and sido_prefixes("대구") == {"07"}
    assert sido_prefixes("광주") == {"06", "12"} == sido_prefixes("전남")   # 전남광주통합특별시


def test_open_filter_and_region():
    rows = items("senuri_list.xml")
    assert len(rows) == 40
    assert sum(is_open(r, TODAY) for r in rows) == 30
    seoul = pick(rows, "서울", TODAY)
    assert seoul and all(r["workPlc"].startswith("01") and is_open(r, TODAY) for r in seoul)
    assert [r["frDd"] for r in seoul] == sorted((r["frDd"] for r in seoul), reverse=True)
    dup = pick(rows + rows, "서울", TODAY)
    assert len(dup) == len(seoul)                        # jobId 중복 제거


def test_clean_job_with_detail():
    row = next(r for r in items("senuri_list.xml") if r["jobId"] == "KJKJ002611050005")
    detail = items("senuri_detail.xml")[0]
    j = clean_job(row, detail, TODAY)
    assert j.place_hint == "진접읍" and j.title.startswith("진접해밀마을")
    assert j.senior_pref                                 # '(준)고령자(50세이상)'
    assert j.region == "서울"                            # 회사 소재지 기준(근무지는 경기 남양주)
    assert j.address.startswith("서울특별시 강서구")    # 우편번호 제거
    assert j.days_left == (date(2026, 12, 4) - TODAY).days
    assert j.url == WORK24_DETAIL.format("KJKJ002611050005")
    assert "담당자" not in str(j.to_dict()) and "대표자" not in str(j.to_dict())


def test_bracket_only_title():
    j = clean_job({"jobId": "K1", "recrtTitle": "[서면아이파크 커뮤니티 미화원 채용]", "toDd": "20261201"}, None, TODAY)
    assert j.title == "서면아이파크 커뮤니티 미화원 채용" and j.place_hint is None
    j = clean_job({"jobId": "K2", "recrtTitle": "[2026 강동구일자리매칭데이 현장면접 참여사업장] 요양보호사 채용", "toDd": "20261201"}, None, TODAY)
    assert j.title.startswith("[2026") and "참여사업장]" in j.title    # 긴 괄호는 그대로(한쪽만 지우지 않음)


def test_agencies_by_region():
    rows = items("senuri_agencies.xml")
    seoul = clean_agencies(rows, "서울")
    assert seoul and all(a.address.startswith("서울") for a in seoul)
    assert all(a.map_url.startswith("https://map.naver.com/p/search/") for a in seoul)
    assert all("*" not in a.address for a in seoul)      # 가려진 전화번호는 쓰지 않음
