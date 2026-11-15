"""Service configuration from environment; the core library keeps its own env handling."""
import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    checkpoint_db: str = field(default_factory=lambda: os.getenv("INVEST_CHECKPOINT_DB", str(ROOT / "runtime" / "checkpoints.sqlite")))
    max_concurrent_runs: int = field(default_factory=lambda: int(os.getenv("INVEST_MAX_CONCURRENT_RUNS", "2")))
    cors_origins: tuple[str, ...] = field(default_factory=lambda: tuple(
        o.strip() for o in os.getenv("INVEST_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()))
    sse_poll_seconds: float = field(default_factory=lambda: float(os.getenv("INVEST_SSE_POLL_SECONDS", "0.2")))


def load_settings() -> Settings:
    """Load backend/.env first (same as the Streamlit shell) so DASHSCOPE_API_KEY etc. are visible."""
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass
    return Settings()
