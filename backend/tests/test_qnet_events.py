"""Q-Net·채용행사 정제 테스트. 픽스처는 2026-11-13 실제 응답을 잘라 저장한 것이다(키 없이 동작)."""
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

from app.cleaning.events import clean_event, clean_title, upcoming
from app.cleaning.qnet import clean_schedule, clean_venues, d8, next_step, parse_fee, training_keyword
from app.clients.qnet import parse_items
from app.clients.work24 import parse_events_xml
from app.routers.hub import links, ranking, stats

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2026, 11, 13)


def items(name):
    return parse_items(ET.parse(FIX / name).getroot())


# ---------------------------------------------------------------- 날짜·응시료·검색어
def test_d8_handles_placeholder():
    assert d8("20261113") == date(2026, 11, 13)
    assert d8("XXXXXXXX") is None and d8("") is None and d8(None) is None


def test_fee_parsed_to_ints():
    fee = parse_fee(items("qnet_fee_7875.xml"))
    assert fee["written"] == 14500 and fee["practical"] == 25200


def test_training_keyword():
    assert training_keyword("지게차운전기능사") == "지게차"
    assert training_keyword("한식조리기능사") == "한식조리"
    assert training_keyword("미용사(일반)") == "미용사"
    assert training_keyword("전기기능사") == "전기"
    assert training_keyword("공인중개사") == "공인중개사"


# ---------------------------------------------------------------- 시험 일정
def test_schedule_always_exam_future_rounds_only():
    rows = items("qnet_schedule_7875.xml")
    assert len(rows) == 41                      # 상시 시험: 1년에 41회차
    rounds = clean_schedule(rows, TODAY, limit=4)
    assert 1 <= len(rounds) <= 4
    assert all(r.always for r in rounds)
    dates = [r.next_step["date"] for r in rounds]
    assert dates == sorted(dates)               # 가까운 순
    assert all(r.next_step["days"] >= 0 for r in rounds)
    assert all(r.next_step["key"].endswith("_reg") for r in rounds)   # 상시: 접수 가능한 회차만


def test_next_step_ongoing_vs_upcoming():
    from app.cleaning.qnet import Step
    steps = [Step("written_reg", "필기 원서접수", date(2026, 11, 10), date(2026, 11, 15)),
             Step("written_exam", "필기시험", date(2026, 11, 20), date(2026, 11, 20))]
    ns = next_step(steps, TODAY)
    assert ns["status"] == "ongoing" and ns["days"] == 2      # 마감까지 2일
    ns = next_step(steps, date(2026, 11, 16))
    assert ns["key"] == "written_exam" and ns["status"] == "upcoming" and ns["days"] == 4


def test_duplicate_round_rows_merge_as_extra_reg():
    a = {"implplannm": "2026년 정기 기능사 1회", "docregstartdt": "20261201", "docregenddt": "20261204",
         "docexamstartdt": "20261220", "docexamenddt": "20261220"}
    b = dict(a, docregstartdt="20261210", docregenddt="20261211")
    rounds = clean_schedule([a, b], TODAY)
    assert len(rounds) == 1
    assert rounds[0].extra_reg and rounds[0].extra_reg[0]["start"] == "2026-12-10"


# ---------------------------------------------------------------- 시험장
def test_venues_rooms_merged_and_temporary_sites_dropped():
    rows = items("qnet_venues_04.xml")
    assert len(rows) == 581                     # 방(호실)·학교까지 모두 한 줄씩
    venues = clean_venues(rows, "대구")
    assert 0 < len(venues) < 60                 # 상설 시험장만, 건물 단위로 합침
    assert all(v.type in ("디지털시험센터", "상설 시험장") for v in venues)
    centers = [v for v in venues if v.type == "디지털시험센터"]
    assert len({v.address.split("(")[0][:18] for v in centers}) == len(centers)   # 같은 건물 중복 없음
    center = centers[0]
    assert center.rooms > 1 and "[" not in center.name
    assert all("()" not in v.name and not v.name.endswith("실") for v in venues)
    assert center.sido == "대구" and center.sigungu
    assert not center.address.startswith("(")


# ---------------------------------------------------------------- 채용행사
def test_event_title_cleaning():
    t, host = clean_title("★ [춘천고용센터 일자리 수요데이 행사 ] ★테라로사 춘천의암호점 정규직 바리스타 모집")
    assert host == "춘천고용센터 일자리 수요데이 행사" and t.startswith("테라로사")
    t, host = clean_title("75_(일자리 수요데이) 취업이음+ (주)위드윈앤코스 구인구직만남의 날 행사")
    assert host == "일자리 수요데이" and t.startswith("취업이음+")
    t, _ = clean_title("[동작취업지원센터  현장면접] 다이소 동작, 관악지역 매장 근무자 채용// ★26년 11월 26일(목) 14:00 ★")
    assert "//" not in t and t.endswith("채용")
    t, host = clean_title("〔2026 하반기 송파구 취업성공19데이 - 서울동부 일자리 수요데이〕 채용행사")
    assert t == host and "송파구" in t


def test_event_place_from_free_text():
    from app.cleaning.events import clean_place
    assert clean_place("❍일 시 : 2026. 11. 19.(목) 14:00 ❍장 소 : 수원시청 별관 2층 ❍문 의 : 031") == "수원시청 별관 2층"
    assert clean_place("❍일 시 : 2026. 11. 19.(목)") is None
    assert clean_place("송파구청 4층 대강당") == "송파구청 4층 대강당"


def test_events_upcoming_and_detail():
    rows = parse_events_xml(ET.parse(FIX / "events_51.xml").getroot())
    fut = upcoming(rows, TODAY)
    assert fut and all(r["startDt"] >= "2026-11-13" for r in fut)
    detail = {c.tag: (c.text or "") for c in ET.parse(FIX / "event_detail.xml").getroot()}
    ev = clean_event({"eventNo": "49502", "eventNm": detail["eventNm"], "startDt": "2026-11-26", "area": "서울/강원 지역"},
                     detail, TODAY)
    assert ev.days_left == 13 and ev.time == "14:00~16:00"
    assert ev.place.startswith("서울시 동작구") and ev.phone
    assert not hasattr(ev, "email") and not hasattr(ev, "charger")   # 담당자 개인정보는 쓰지 않음


# ---------------------------------------------------------------- 순위·바로가기
def test_ranking_from_stats_file():
    st = stats()
    assert st["grade"] == "기능사" and st["by_sido"]["대구"]
    top = ranking("대구", None, limit=5)
    assert [x["rank"] for x in top] == [1, 2, 3, 4, 5]
    assert top[0]["count"] >= top[-1]["count"]
    cook = ranking("대구", "조리·제과제빵")
    assert cook and all(x["field"] in ("조리", "제과.제빵") for x in cook)
    assert any(x["always"] for x in cook)        # 조리·제과제빵 기능사는 상시 시험


def test_links_encode_region_and_keyword():
    ln = links("대구", "요양보호사", "요양보호사")
    assert {l["site"] for l in ln["jobs"]} >= {"고용24", "사람인"}
    assert "%EB%8C%80%EA%B5%AC" in ln["jobs"][0]["url"]      # '대구' 인코딩
    dg = next(l for l in ln["alba"] if l["site"] == "당근알바")
    assert "%EB%8C%80%EA%B5%AC" not in dg["url"] and "대구" in dg["note"]   # 당근은 지역을 검색어로 못 바꿈
    assert all(l["icon"] for l in ln["jobs"] + ln["alba"])


def test_age_top_file_shape():
    from app.routers.hub import age_top_raw
    d = age_top_raw()
    assert d["source"].startswith("한국산업인력공단") and d["basis"] == "응시"
    assert d["groups"]["60대 이상"]["기능사"]["ranked"][0] == "지게차운전기능사"
    assert d["groups"]["50대"]["기사"]["ranked"] == ["전기기사"]
    assert len(d["groups"]["50대"]["기능사"]["ranked"]) == 4


def test_gwangju_jeonnam_same_area():
    from app.codes import same_area
    assert same_area("광주", "전남") and same_area("전남", "광주") and same_area("서울", "서울")
    assert not same_area("광주", "전북") and not same_area("대구", None)
    rows = [{"examAreaGbNm": "국가자격시험장(구공단상설)", "examAreaNm": "광주 상설시험장", "address": "전남광주통합특별시 서구 상무대로 1"}]
    assert len(clean_venues(rows, "광주")) == 1      # 통합 이름 주소도 광주 시험장으로
