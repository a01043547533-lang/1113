import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

from app.cleaning.common import split_sido, to_date, to_int
from app.cleaning.training import clean_training, dedupe_trainings
import pytest

from app.clients.work24 import Work24Error, check_error, parse_trainings_xml

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2025, 11, 13)


def load_trainings():
    _, raw = parse_trainings_xml(ET.parse(FIX / "training_sample.xml").getroot())
    return [clean_training(r, TODAY) for r in raw]


# ---------------------------------------------------------------- common
def test_to_int_and_date_variants():
    assert to_int("2,200,000원") == 2_200_000
    assert to_int(" - ") is None
    assert to_int("0") == 0
    assert to_date("25-11-13") == date(2025, 11, 13)
    assert to_date("20251113") == date(2025, 11, 13)
    assert to_date("2025.12.01 18:00") == date(2025, 12, 1)
    assert to_date("채용시까지") is None


def test_split_sido():
    assert split_sido("대구광역시 달서구 월배로 100")[:2] == ("대구", "달서구")
    assert split_sido("경기 성남시 분당구")[:2] == ("경기", "성남시 분당구")
    assert split_sido("전국")[:2] == (None, None)


# ---------------------------------------------------------------- training end-to-end
def test_training_cleaned_fields():
    ts = {(t.id, t.round): t for t in load_trainings()}

    a = ts[("AIG20250001", "3")]
    assert a.title == "요양보호사 양성과정" and a.tags == ["국민내일배움카드"]
    assert a.institution == "대구행복요양보호사교육원"
    assert a.url.startswith("https://www.work24.go.kr/hr/")
    assert a.sido == "대구" and a.sigungu == "달서구"
    assert a.ncs1 == "07" and a.ncs1_name == "사회복지·종교"
    assert a.duration_weeks == 13 and a.days_until_start == 18
    assert a.total_cost == 1_200_000 and a.real_cost == 180_000
    assert a.satisfaction == 92.0                # 4.6/5 → 92/100
    assert a.fill_ratio == 0.73 and a.weekend == "주중"
    assert a.employment_rate_6m == 70.1

    b = ts[("AIG20250002", "1")]
    assert b.start_date == date(2025, 11, 20) and b.duration_weeks == 4
    assert b.satisfaction is None
    assert "employment_rate_missing" in b.quality_flags
    assert b.enrolled is None and b.fill_ratio is None

    c = ts[("AIG20250003", "1")]
    assert "already_started" in c.quality_flags
    assert c.employment_rate_3m == 45.0 and c.employment_rate_6m == 50.0   # 0.45 → 45%
    assert c.url is None

    d = ts[("AIG20250004", "1")]
    assert "end_before_start" in d.quality_flags
    assert "region_unparsed" in d.quality_flags
    assert d.institution is None


def test_dedupe_trainings_keeps_earliest_round():
    ts = dedupe_trainings(load_trainings())
    ids = [t.id for t in ts]
    assert ids.count("AIG20250001") == 1
    kept = next(t for t in ts if t.id == "AIG20250001")
    assert kept.round == "3"


def test_training_score_ordering():
    ts = dedupe_trainings(load_trainings())
    ts.sort(key=lambda t: -t.score)
    assert ts[0].id == "AIG20250001"   # 취업률 70% + 만족도 92 + 곧 시작


def test_real_api_shape_satisfaction_100_scale_and_zero():
    base = {"trprId": "X", "title": "t", "traStartDate": "2025-11-20", "traEndDate": "2025-12-20",
            "courseMan": "3599360", "realMan": "3599360", "eiEmplRate3": "", "eiEmplRate6": ""}
    t1 = clean_training({**base, "stdgScor": "92.3"}, TODAY)
    t0 = clean_training({**base, "stdgScor": "0"}, TODAY)
    assert t1.satisfaction == 92.3 and t0.satisfaction is None
    assert t1.score > t0.score
    assert t1.real_cost == 3_599_360 and not hasattr(t1, "self_pay")


# ---------------------------------------------------------------- API error detection
def test_check_error_detects_go24_error():
    root = ET.fromstring("<GO24><error>개인회원은 사용할 수 없는 OPEN-API입니다.</error></GO24>")
    with pytest.raises(Work24Error, match="개인회원"):
        check_error(root)
    check_error(ET.fromstring("<HRDNet><scn_cnt>0</scn_cnt></HRDNet>"))  # 정상 0건은 통과
