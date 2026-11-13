"""환경 설정. .env 파일에서 읽는다 (.env.example 참고)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 고용24 Open API 인증키 (work24.go.kr > 고객센터 > OPEN-API > 서비스 소개 및 신청)
    # WORK24_TRAINING_KEY: 국민내일배움카드 훈련과정(310L01)
    # WORK24_JOB_KEY: 채용행사(210L11)에 쓴다. 일반 채용정보(210L01)는 기업회원 전용이라 개인 키로는 안 된다.
    WORK24_JOB_KEY: str = ""
    WORK24_TRAINING_KEY: str = ""

    # 공공데이터포털 인증키(선택). Q-Net API는 2026-11 현재 키 없이도 응답하지만, 있으면 함께 보낸다.
    DATA_GO_KR_KEY: str = ""

    WORK24_BASE: str = "https://www.work24.go.kr/cm/openApi/call"
    HTTP_TIMEOUT: float = 15.0

    # 간단한 메모리 캐시 TTL(초). 일일 호출량 제한 때문에 반드시 캐시한다.
    CACHE_TTL: int = 60 * 30

    CORS_ORIGINS: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
