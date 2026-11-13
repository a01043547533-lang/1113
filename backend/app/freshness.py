"""데이터 출처별 '마지막으로 원본 API에서 받아 온 시각'을 기억한다(메모리, 서버를 다시 켜면 비워짐).

각 클라이언트가 캐시를 거치지 않고 실제로 받아 왔을 때 mark(이름)을 부른다.
GET /api/status 가 이 값을 그대로 보여 준다.
"""
from __future__ import annotations

from datetime import datetime, timezone

# 이름 → (화면 이름, 제공 기관, 다시 받는 주기 설명)
SOURCES = {
    "training": ("국비 교육 과정", "고용24", "30분마다"),
    "qnet_schedule": ("자격증 시험 일정·응시료", "한국산업인력공단 Q-Net", "6시간마다"),
    "qnet_venues": ("시험장", "한국산업인력공단 Q-Net", "6시간마다"),
    "qnet_list": ("자격증 종목 목록", "한국산업인력공단 Q-Net", "6시간마다"),
    "events": ("채용행사·현장면접", "고용24", "30분마다"),
    "senior_jobs": ("중장년 채용공고", "한국노인인력개발원", "1시간마다"),
    "agencies": ("노인일자리 기관", "한국노인인력개발원", "하루마다"),
}

# 다시 받는 주기(분). 캐시 시간과 같다. 이보다 오래되면 화면에 '오래됨'으로 표시.
TTL_MIN = {"training": 30, "qnet_schedule": 360, "qnet_venues": 360, "qnet_list": 360,
           "events": 30, "senior_jobs": 60, "agencies": 1440}

_last: dict[str, datetime] = {}
_note: dict[str, str] = {}


def mark(name: str) -> None:
    _last[name] = datetime.now(timezone.utc)


def last(name: str) -> datetime | None:
    return _last.get(name)


def set_note(name: str, text: str | None) -> None:
    """받아 온 데이터 자체에 대한 짧은 설명(예: 가장 최근 공고 등록일)."""
    if text:
        _note[name] = text
    else:
        _note.pop(name, None)


def note(name: str) -> str | None:
    return _note.get(name)


def reset() -> None:   # 테스트용
    _last.clear()
    _note.clear()
