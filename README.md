# 50+ 재취업 길잡이 (jobmatch50)

50대 이상 중장년 구직자를 위한 재취업 정보 통합 서비스. **배우고, 취득하고, 다시 일하기.**
거주 지역(시·도)과 관심 분야(조리·제과제빵, 운전·중장비, 전기·설비, 요양·돌봄, 경비, 사무·부동산 등 10개)를 고르면
네 가지를 한 화면에 모아 보여준다.

| 탭 | 내용 | 데이터 |
|---|---|---|
| 시험·자격증 | 우리 지역에서 많이 응시한 자격증 순위 → 누르면 다음 시험 D-day·응시료·지역 상설 시험장·국비 과정 | 한국산업인력공단 Q-Net OPEN-API |
| 국비 교육 | 3개월 안에 시작하는 국민내일배움카드 과정 | 고용24 훈련과정 API |
| 취업 | 우리 권역 고용센터 채용행사·현장면접(날짜·장소·참여 기업·문의 전화) + 고용24·사람인·잡코리아 같은 조건 검색 바로가기 | 고용24 채용행사 API |
| 알바 | 알바몬·당근알바 같은 조건 검색 바로가기, 알바 주의사항 | (공개 API 없음 → 링크만) |

무료, 회원가입 없음, **개인정보를 수집·저장하지 않는다** (로그인·DB 없음).

- 프런트: React 18 + Vite
- 백엔드: FastAPI (외부 API 호출 + 정제 + 메모리 캐시)
- 배포: AWS EC2 (Nginx가 React 정적 파일 서빙, `/api`는 Uvicorn으로 프록시)

```
jobmatch50/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI 진입점 (/health)
│   │   ├── config.py            .env 설정
│   │   ├── codes.py             시·도 코드, Q-Net 지사·채용행사 권역 코드, 관심 분야 10개
│   │   ├── build_stats.py       Q-Net 접수 통계 → data/qnet_stats_YYYY.json (미리 만들어 둠)
│   │   ├── data/                지역·종목별 접수자 수 집계 파일
│   │   ├── clients/
│   │   │   ├── qnet.py          Q-Net: 종목 목록, 종목별 일정, 응시료, 시험장
│   │   │   └── work24.py        고용24: 훈련과정, 채용행사(목록·상세)
│   │   ├── cleaning/
│   │   │   ├── common.py        숫자·날짜·주소 파싱
│   │   │   ├── qnet.py          시험 일정·응시료·시험장 정제
│   │   │   ├── events.py        채용행사 정제
│   │   │   └── training.py      훈련과정 정제
│   │   └── routers/hub.py       GET /api/meta, /api/hub, /api/cert/{종목코드}
│   ├── tests/                   실제 응답을 잘라 둔 픽스처 + pytest (키 없이 동작)
│   └── requirements.txt
├── frontend/src/
│   ├── App.jsx                  랜딩 + 검색 + 결과 탭
│   ├── sections.jsx             시험·교육·취업·알바 탭 화면
│   └── art.jsx                  줄무늬 그림·아이콘 (코드로 생성)
└── deploy/                      EC2용 nginx.conf, systemd 서비스, setup.sh, update.sh
```

## 1. API와 키

| API | 키 | 비고 |
|---|---|---|
| Q-Net 종목 목록 `InquiryListNationalQualifcationSVC` | 불필요 | 국가자격 613개, 종목코드·분야 |
| Q-Net 종목별 일정 `InquiryTestInformationNTQSVC/getJMList` | 불필요 | 상시 시험·국가전문자격 포함 |
| Q-Net 응시료 `InquiryTestInformationNTQSVC/getFeeList` | 불필요 | |
| Q-Net 시험장소 `InquiryExamAreaSVC` | 불필요 | 지사 코드별 |
| Q-Net 거주지별 접수 현황 `InquiryExameeAbdSVC` | 불필요 | 지역·종목·접수자 수. **연령대 항목은 없음** |
| 고용24 훈련과정 (310L01) | `WORK24_TRAINING_KEY` | |
| 고용24 채용행사 (210L11 목록, 210D11 상세) | `WORK24_JOB_KEY` | 개인회원 키로 됨 |

- "키 불필요"는 2026-11-13 실측 결과다. 공공데이터포털 키를 받아 `DATA_GO_KR_KEY`에 넣으면 Q-Net 호출에 함께 보낸다.
- 고용24 **일반 채용정보(210L01)는 기업회원 전용**이라 개인 키로는 `개인회원은 사용할 수 없는 OPEN-API입니다.` 오류가 난다.
  그래서 일반 공고와 알바는 공고를 복사해 오지 않고, 각 사이트의 같은 조건 검색 화면으로 연결한다
  (민간 사이트 무단 수집은 데이터베이스권 침해 판례가 있어 하지 않는다).

## 2. 로컬 실행

```bash
# backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # 고용24 키 입력
uvicorn app.main:app --reload --port 8000
pytest                             # 정제 로직 테스트 (키 없이 동작)

# frontend
cd ../frontend
npm install
npm run dev                        # http://localhost:5173  (/api → 8000 프록시)
```
8000번 포트를 다른 프로그램이 쓰고 있으면 백엔드를 `--port 8010`으로 띄우고
`API_URL=http://localhost:8010 npm run dev`로 프런트를 실행한다.

블로그 글에서는 지역·분야·탭을 미리 고른 링크로 바로 결과를 보여줄 수 있다:
`https://도메인/?sido=대구&preset=조리·제과제빵&tab=exams` (`tab`: exams / trainings / jobs / alba)

### 접수 통계 갱신
지역별 자격증 순위는 `backend/app/data/qnet_stats_YYYY.json`을 읽는다. 1년치 기능사 데이터가 약 6만 행이라 미리 만들어 둔다.
```bash
cd backend && python -m app.build_stats --year 2025     # 약 1분, 60회 호출
```
새 연도 파일이 생기면 가장 최근 연도를 자동으로 쓴다.

## 3. 데이터 정제

### 시험·자격증 (`cleaning/qnet.py`, `build_stats.py`)
| 원본 | 실제로 오는 값 | 정제 |
|---|---|---|
| 접수 통계 | 거주지 × 시험회차 × 종목 행 59,974개(2025 기능사) | 시·도별 종목 접수자 수 합산 → 141개 종목 순위. 거주지 '미상'은 지역 순위에서 제외 |
| 회차명 | `2026년 상시 기능사 23회` | '상시'가 있으면 상시 시험 종목으로 표시 |
| 일정 날짜 | `20261113`, 해당 없으면 `XXXXXXXX` | ISO 날짜, 없으면 None. 오늘 기준 '다음 할 일'과 D-day 계산 |
| 일정 중복 | 같은 회차가 접수기간만 다른 행으로 2번 | 회차 하나로 합치고 나머지는 '추가 접수 기간' |
| 상시 시험 | 1년에 41회차 | 아직 접수할 수 있는 회차만 가까운 순으로 |
| 응시료 | `1차 : 14500, 2차 : 25200 ` | 필기/실기(1차/2차) 정수 |
| 시험장 | 방마다 한 줄(서울 지사 806행), 학교·임시 시험장 포함, `[CBT 1실]`, `(유료주차 주차협소)` | 상설 시험장만, 도로명+건물번호 기준으로 합침, 주차 정보는 따로 뽑음 |
| 국비 과정 검색어 | `지게차운전기능사` | `지게차` (등급·'운전'·괄호 제거. 실측: 6건 → 9건) |

### 채용행사 (`cleaning/events.py`)
| 원본 | 실제로 오는 값 | 정제 |
|---|---|---|
| 행사명 | `★ [춘천고용센터 일자리 수요데이 행사 ] ★테라로사 … 모집`, `75_(일자리 수요데이) …`, `…채용// ★26년 11월 26일(목) 14:00 ★` | 장식 기호·번호·꼬리 날짜 제거, 앞머리 [..]는 주최로 분리 |
| 목록 | 지난 1년치 약 1,800건 | 오늘 이후 행사만 가까운 순, 중장년 대상 행사를 위로 |
| 장소 | `❍일 시 : … ❍장 소 : ○○구청 …` | 장소 부분만 |
| 상세 | 담당자 이름·이메일 포함 | **쓰지 않음**(기관 문의 전화만) |

### 국비 교육 (`cleaning/training.py`)
수강비(`courseMan`)만 보여주고 자부담은 "카드 종류·소득에 따라 다름"으로 안내한다(`realMan`은 자부담이 아님 — 실측 100건 중 92건이 수강비와 같음).
만족도는 100점 만점으로 통일하고 0은 '평가 없음'. 회차만 다른 같은 과정은 가장 빨리 시작하는 회차 1건만 남긴다.

### 정제 로직을 고칠 때
`backend/tests/fixtures/`에 실제 응답에서 본 이상한 케이스를 추가하고 `pytest`로 확인한다.
픽스처에 개인정보(담당자 이름·이메일 등)가 들어가지 않게 지운 뒤 커밋한다.

## 4. AWS EC2 배포

1. EC2 인스턴스 생성: Ubuntu 22.04/24.04, t2.micro(또는 t3.micro), 보안 그룹 인바운드 **22(내 IP), 80, 443** 허용
2. 접속 후:
   ```bash
   git clone https://github.com/a01043547533-lang/1113.git jobmatch50
   cd jobmatch50
   bash deploy/setup.sh          # 처음엔 .env가 없어서 멈춘다
   nano backend/.env             # 고용24 키 입력
   bash deploy/setup.sh          # 다시 실행 → 패키지 설치, 빌드, nginx·systemd 등록
   ```
3. 브라우저에서 `http://<EC2 퍼블릭 IP>` 접속
4. 코드를 고친 뒤에는 서버에서 `bash deploy/update.sh` (git pull → 테스트 → 빌드 → 재시작)
5. 도메인을 연결했으면 `deploy/nginx.conf`의 `server_name`을 바꾸고
   `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx`로 HTTPS 적용

로그 보기: `sudo journalctl -u jobmatch50 -f`

`.env`(인증키)는 `.gitignore`에 들어 있어 GitHub에 올라가지 않는다. 서버에서 직접 만든다.

## 5. 다음 단계
- 공공데이터포털 '한국노인인력개발원 노인 구인정보' 또는 사람인 API 승인 시 취업 탭에 실제 공고 연결
- 자격증 상세에서 종목별 시험장(실기 장소) 연결
- 분야별 "다음 달 접수 마감 자격증" 모아보기 (블로그 글 소재)
