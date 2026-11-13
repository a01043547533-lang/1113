# 50+ 재취업 길잡이 (jobmatch50)

50대 이상 중장년 구직자를 위한 재취업 정보 통합 서비스.
거주 지역과 희망 직종(요양보호사, 경비, 조리, 사무보조 등)을 고르면
**고용24 채용공고**와 **국민내일배움카드 국비 훈련과정**을 한 화면에 함께 보여준다.
급여 단위 통일, 마감일 정리, 중복 공고 제거 같은 정제를 거쳐 보기 쉽게 제공한다.
무료 서비스이며 **개인정보를 수집·저장하지 않는다** (로그인·DB 없음, 검색 조건은 요청 때만 쓰고 버린다).

- 프런트: React 18 + Vite
- 백엔드: FastAPI (고용24 OPEN-API 호출 + 정제 + 30분 메모리 캐시)
- 배포: AWS EC2 (Nginx가 React 정적 파일 서빙, `/api`는 Uvicorn으로 프록시)

```
jobmatch50/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI 진입점 (/health)
│   │   ├── config.py          .env 설정
│   │   ├── codes.py           시도·NCS·직종 프리셋·고용형태 코드표
│   │   ├── clients/work24.py  고용24 API 호출, XML → dict, 오류 응답 감지, 캐시
│   │   ├── cleaning/
│   │   │   ├── common.py      숫자·날짜·주소 파싱 유틸
│   │   │   ├── jobs.py        채용공고 정제 (급여 월환산, 경력, 학력, 마감일, 중복, 50대 적합도)
│   │   │   └── training.py    훈련과정 정제 (훈련비, 만족도, 기간, 회차 중복, 추천점수)
│   │   └── routers/match.py   GET /api/match, GET /api/meta
│   ├── tests/                 샘플 XML 픽스처 + pytest
│   ├── requirements.txt
│   └── .env.example
├── frontend/                  Vite + React
└── deploy/                    EC2용 nginx.conf, systemd 서비스, setup.sh, update.sh
```

## 1. API 키 발급

워크넷·HRD-Net API는 **고용24 OPEN-API**로 통합됐다 (data.go.kr 아님).

1. https://www.work24.go.kr 로그인 → 하단 **고객센터 → OPEN-API → 서비스 소개 및 신청**
2. 두 개를 각각 활용신청
   - **채용정보** (`callOpenApiSvcInfo210L01.do`)
   - **국민내일배움카드 훈련과정** (`callOpenApiSvcInfo310L01.do`)
3. 승인된 인증키를 `backend/.env`에 넣는다 (`.env.example` 복사).

> ⚠️ **채용정보 API는 개인회원 키로는 호출이 안 된다.**
> 2026-11-13 실측 응답: `<GO24><error>개인회원은 사용할 수 없는 OPEN-API입니다.</error></GO24>`
> 이 경우 화면에는 "지금은 채용공고를 불러오지 못했어요 + 고용24에서 직접 찾아보기" 안내가 뜨고,
> 훈련과정은 정상적으로 나온다. 신청 자격(기업·기관 회원 등)은 고용24 OPEN-API 공지 또는 고객센터에서 확인.

채용정보 API에는 **연령 조건 파라미터가 없다**(연령차별 금지). 그래서 '나이'는 필터가 아니라
제목·경력·학력 신호로 계산하는 `senior_score`(50대 적합도) 안내에만 쓴다.

## 2. 로컬 실행

```bash
# backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # 키 입력
uvicorn app.main:app --reload --port 8000
pytest                             # 정제 로직 테스트 (API 키 없이 동작)

# frontend
cd ../frontend
npm install
npm run dev                        # http://localhost:5173  (/api → 8000 프록시)
```

## 3. 데이터 정제 설계

두 API 모두 XML이고 값이 사람이 입력한 그대로 온다. 같은 의미가 여러 표기로 섞여 있어서
그대로 쓰면 정렬·필터·비교가 틀어진다.

### 채용공고 (`cleaning/jobs.py`)

| 원본 필드 | 실제로 오는 값 예시 | 정제 결과 |
|---|---|---|
| `sal`, `minSal`, `maxSal`, `salTpNm` | `월급 2,200,000원 이상` / `연봉 3,000만원 ~ 3,600만원` / `시급 10,030원` / `면접후 결정` | `salary.monthly_min/max`(월 환산 원), `type`, `estimated`(시급×209h, 일급×21.75일 환산이면 true) |
| `region` | `대구광역시 달서구` / `대구 북구,대구 동구` / `전국` | `regions[{sido, sigungu}]`, 다중지역 분리, 시도 표준명 통일 |
| `career` | `관계없음` / `경력 3년이상` / `신입/경력 1년 ~ 3년` | `career.type`, `min_years`, `max_years` |
| `minEdubg` | `학력무관` / `고졸이하` / `대졸(2~3년)이상` | `education_rank`(0~7) |
| `regDt`, `closeDt` | `25-11-13` / `2025.12.01 18:00` / `채용시까지` | ISO 날짜, `until_filled`, `days_left`, 지난 공고 제외 |
| `title` | `&amp;` 엔티티, 길면 `...` 잘림 | 엔티티 해제, `title_truncated` 플래그 |
| `empTpCd` | `10`, `11`, `20`, `21`, 모르는 코드 | 라벨 매핑, 모르면 None |
| 중복 | 같은 공고가 지역별로 여러 건 | `wantedAuthNo` + (회사, 제목, 시도) 기준 제거 |

**`senior_score`(0~100)**: 기본 50. 제목에 중장년/연령무관 +30, 청년/신입공채 −30, 경력무관 +10,
고졸 이하/학력무관 +10, 시간선택제 +5, 급여 미정 −5. 근거는 `senior_reasons`에 담긴다.

### 훈련과정 (`cleaning/training.py`)

2026-11 실제 응답(대구, 100건)을 보고 맞춘 내용:

| 원본 필드 | 실측 | 정제 결과 |
|---|---|---|
| `courseMan` / `realMan` | 92건이 서로 같음, 8건은 realMan이 더 큼 | `total_cost`(수강비), `real_cost`. **realMan은 자부담이 아니다** → 목록 API로는 자부담을 알 수 없어 화면에 "카드 종류·소득에 따라 다름"으로 안내 |
| `eiEmplRate3/6` | 100건 모두 빈값 | 들어오면 %로 통일(0.45 → 45), 없으면 None |
| `stdgScor` | `92.3`, `100`, `0` (61건만 값 있음) | 100점 만점으로 통일, `0`은 평가 없음(None) |
| `traStartDate/EndDate` | `2026-12-29` / `20251201` | ISO 날짜, `duration_weeks`, `days_until_start`, 이미 시작한 과정 제외 |
| `title` | `[국민내일배움카드] 요양보호사 양성과정 (3회차)` | 태그·회차 제거, `tags[]` |
| 중복 | 같은 `trprId`가 회차만 다르게 | 가장 빨리 시작하는 회차 1건 |

**검색 전략**: NCS 분류와 과정명을 같이 걸면 대부분 0건이 된다(실측: 대구 요양보호사 0건, 과정명만 31건).
그래서 과정명으로 먼저 찾고, 0건이면 NCS 대분류 전체로 넓힌 뒤 화면에 그 사실을 알린다.

**추천 점수 `score`**: 취업률(있을 때, 최대 40) + 만족도(최대 30) + 시작 임박(최대 15) + 훈련비 낮을수록(최대 15).

### 정제 로직을 고칠 때
`backend/tests/fixtures/*.xml`에 실제 응답에서 본 이상한 케이스를 추가하고 `pytest`로 확인한다.

## 4. AWS EC2 배포

1. EC2 인스턴스 생성: Ubuntu 22.04/24.04, t2.micro(또는 t3.micro), 보안 그룹 인바운드 **22(내 IP), 80, 443** 허용
2. 접속 후:
   ```bash
   git clone https://github.com/a01043547533-lang/1113.git jobmatch50
   cd jobmatch50
   bash deploy/setup.sh          # 처음엔 .env가 없어서 멈춘다
   nano backend/.env             # 인증키 입력
   bash deploy/setup.sh          # 다시 실행 → 패키지 설치, 빌드, nginx·systemd 등록
   ```
3. 브라우저에서 `http://<EC2 퍼블릭 IP>` 접속
4. 코드를 고친 뒤에는 서버에서 `bash deploy/update.sh` (git pull → 테스트 → 빌드 → 재시작)
5. 도메인을 연결했으면 `deploy/nginx.conf`의 `server_name`을 바꾸고
   `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx`로 HTTPS 적용

로그 보기: `sudo journalctl -u jobmatch50 -f`

`.env`(인증키)는 `.gitignore`에 들어 있어 GitHub에 올라가지 않는다. 서버에서 직접 만든다.

## 5. 다음 단계
- 채용정보 API 이용 자격 해결 (안 되면 다른 공개 채용 데이터 검토)
- 제목 잘림 시 상세 API(210D01)로 전체 제목 보완
- 시군구 선택 (근무지역 중분류 코드)
- 블로그 글에서 직종·지역을 미리 고른 링크(`?sido=대구&preset=요양보호사`)로 바로 들어오게
