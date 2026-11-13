"""거주지별 기술자격 접수자 수(Q-Net InquiryExameeAbdSVC)를 받아 지역·종목별로 합산해 JSON으로 저장.

1년치 기능사 데이터가 약 6만 행(1,000행 × 60쪽)이라 요청마다 받지 않고 미리 만들어 둔다.
통계는 연 단위라 한 달에 한 번 정도 다시 돌리면 충분하다.

    python -m app.build_stats --year 2025

정제:
- 같은 거주지·종목이 시험 회차(implPlanNm)마다 여러 행 → 접수자 수 합산
- 거주지 '미상'은 지역 순위에서 제외(전국 합계에는 포함)
- 회차명에 '상시'가 있으면 상시 시험 종목으로 표시
- 종목명으로 종목 목록 API의 종목코드(jmcd)·분야를 붙임
※ 이 API에는 연령대 정보가 없다(설명과 달리 출력 항목에 없음). 그래서 '전체 접수자' 기준 순위다.
"""
from __future__ import annotations

import argparse
import json
import time
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

import httpx

from app.clients.qnet import QNET, parse_items
from app.config import get_settings

DATA_DIR = Path(__file__).parent / "data"
GRADES = {"40": "기능사"}


def _get(client: httpx.Client, path: str, **params) -> list[dict]:
    key = get_settings().DATA_GO_KR_KEY
    if key:
        params["serviceKey"] = key
    for attempt in range(4):
        try:
            r = client.get(f"{QNET}/{path}", params=params)
            r.raise_for_status()
            return parse_items(ET.fromstring(r.text.strip()))
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    return []


def build(year: int) -> dict:
    by_sido: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    national: dict[str, int] = defaultdict(int)
    always: set[str] = set()
    rows_seen = 0
    with httpx.Client(timeout=60) as client:
        jm = {r["jmfldnm"]: r for r in _get(client, "InquiryListNationalQualifcationSVC/getList")}
        for grd in GRADES:
            page = 1
            while True:
                items = _get(client, "InquiryExameeAbdSVC/getList",
                             baseYY=year, grdCd=grd, numOfRows=1000, pageNo=page)
                if not items:
                    break
                for it in items:
                    name = it.get("jmFldNm", "").strip()
                    cnt = int(it.get("recptCnt") or 0)
                    sido = it.get("abdAddr", "").strip() or "미상"
                    if not name:
                        continue
                    national[name] += cnt
                    if sido != "미상":
                        by_sido[sido][name] += cnt
                    if "상시" in it.get("implPlanNm", ""):
                        always.add(name)
                rows_seen += len(items)
                print(f"  {GRADES[grd]} page {page}: {len(items)} rows (누적 {rows_seen})")
                if len(items) < 1000:
                    break
                page += 1

    def meta(name: str) -> dict:
        m = jm.get(name, {})
        return {"jmcd": m.get("jmcd"), "field": m.get("obligfldnm"), "subfield": m.get("mdobligfldnm")}

    return {
        "year": year,
        "grade": "기능사",
        "source": "한국산업인력공단 거주지별 기술자격 시험 접수 현황(InquiryExameeAbdSVC)",
        "rows": rows_seen,
        "always": sorted(always),
        "meta": {n: meta(n) for n in national},
        "national": dict(sorted(national.items(), key=lambda x: -x[1])),
        "by_sido": {s: dict(sorted(v.items(), key=lambda x: -x[1])) for s, v in sorted(by_sido.items())},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    year = ap.parse_args().year
    out = build(year)
    DATA_DIR.mkdir(exist_ok=True)
    path = DATA_DIR / f"qnet_stats_{year}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved {path} ({out['rows']} rows, {len(out['national'])} 종목, {len(out['by_sido'])} 지역)")


if __name__ == "__main__":
    main()
