"""여러 필드에서 공통으로 쓰는 정제 유틸."""
from __future__ import annotations

import html
import re
from datetime import date, datetime

from app.codes import SIDO_ALIASES

_WS = re.compile(r"\s+")
_NUM = re.compile(r"\d[\d,]*")

# 값이 '없음'을 뜻하는 다양한 표기
NULL_TOKENS = {"", "-", "--", "null", "none", "n/a", "na", "해당없음", "없음", "미정", "미입력", "."}


def clean_text(v: str | None) -> str:
    """HTML 엔티티 해제, 제어문자 제거, 공백 정리."""
    if v is None:
        return ""
    v = html.unescape(v)
    v = v.replace("\xa0", " ").replace("​", "")
    v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", v)
    return _WS.sub(" ", v).strip()


def is_null(v: str | None) -> bool:
    return clean_text(v).lower() in NULL_TOKENS


def to_int(v: str | None) -> int | None:
    """'2,200,000원', ' 1,234 ', '약 30명' → 정수. 숫자 없으면 None."""
    if is_null(v):
        return None
    m = _NUM.search(clean_text(v))
    if not m:
        return None
    try:
        return int(m.group(0).replace(",", ""))
    except ValueError:
        return None


def to_float(v: str | None) -> float | None:
    """'45.5', '45.5%', ' - ' → float or None."""
    if is_null(v):
        return None
    m = re.search(r"\d+(?:\.\d+)?", clean_text(v).replace(",", ""))
    return float(m.group(0)) if m else None


_DATE_PATTERNS = (
    ("%Y-%m-%d", re.compile(r"^\d{4}-\d{2}-\d{2}$")),
    ("%Y.%m.%d", re.compile(r"^\d{4}\.\d{2}\.\d{2}$")),
    ("%Y/%m/%d", re.compile(r"^\d{4}/\d{2}/\d{2}$")),
    ("%Y%m%d", re.compile(r"^\d{8}$")),
    ("%y-%m-%d", re.compile(r"^\d{2}-\d{2}-\d{2}$")),
    ("%y.%m.%d", re.compile(r"^\d{2}\.\d{2}\.\d{2}$")),
    ("%y/%m/%d", re.compile(r"^\d{2}/\d{2}/\d{2}$")),
)


def to_date(v: str | None) -> date | None:
    """'25-11-13', '2025-11-13', '20251113', '2025.11.13 14:00' 등을 date로. 실패하면 None."""
    if is_null(v):
        return None
    s = clean_text(v)
    s = s.split(" ")[0]  # 뒤에 시간이 붙은 경우 제거
    for fmt, pat in _DATE_PATTERNS:
        if pat.match(s):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                return None
    return None


def split_sido(addr: str | None) -> tuple[str | None, str | None, str]:
    """주소/지역 문자열에서 (시도 표준명, 시군구, 원문) 추출.

    '대구광역시 달서구 ...' → ('대구', '달서구', 원문)
    '서울 강남구'          → ('서울', '강남구', 원문)
    '경기 성남시 분당구'    → ('경기', '성남시 분당구', 원문)
    """
    raw = clean_text(addr)
    if not raw:
        return None, None, raw
    tokens = raw.split(" ")
    first = tokens[0]
    sido = SIDO_ALIASES.get(first)
    if sido is None:
        # '대구달서구' 처럼 붙어 있는 경우
        for alias, std in sorted(SIDO_ALIASES.items(), key=lambda x: -len(x[0])):
            if first.startswith(alias):
                sido = std
                tokens = [first[len(alias):]] + tokens[1:] if first[len(alias):] else tokens[1:]
                break
        else:
            return None, None, raw
    else:
        tokens = tokens[1:]
    # 시군구: 구/군/시로 끝나는 연속 토큰(최대 2개: '성남시 분당구')
    sgg_parts = []
    for t in tokens[:2]:
        if re.search(r"(시|군|구)$", t):
            sgg_parts.append(t)
        else:
            break
    return sido, (" ".join(sgg_parts) or None), raw
