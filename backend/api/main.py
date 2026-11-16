"""FastAPI application factory. `uvicorn api.main:app --reload` for development."""
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.db import init_db, make_engine, open_checkpointer
from api.guests import GuestSessions
from api.routes import auth, conversations, reports, runs
from api.runs import RunManager, RunStore
from api.settings import Settings, load_settings


def _langfuse_config():
    try:
        from src.evaluation.langfuse_tracing import get_langfuse_handler
        handler = get_langfuse_handler()
        return {"callbacks": [handler]} if handler else {}
    except Exception:  # noqa: BLE001 - tracing is optional and must never block a run.
        return {}


def create_app(*, graph=None, settings: Settings | None = None, max_workers: int | None = None) -> FastAPI:
    """Tests inject a scripted `graph`; production opens the checkpointed parent graph on startup."""
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        from pathlib import Path
        if settings.database_url.startswith("sqlite:///"):
            Path(settings.database_url[len("sqlite:///"):]).parent.mkdir(parents=True, exist_ok=True)
        engine = make_engine(settings.database_url)
        init_db(engine)
        app.state.engine = engine
        close_checkpointer = None
        runtime_graph = graph
        if runtime_graph is None:
            from src.agent import create_invest_agent
            saver, close_checkpointer = open_checkpointer(settings.database_url)
            runtime_graph = create_invest_agent(checkpointer=saver)
        store = RunStore(engine)
        store.recover()
        app.state.run_manager = RunManager(runtime_graph, store, max_workers=max_workers or settings.max_concurrent_runs,
                                           config_factory=_langfuse_config)
        def guest_graph():
            if graph is not None:
                return graph
            from langgraph.checkpoint.memory import InMemorySaver

            from src.agent import create_invest_agent
            return create_invest_agent(checkpointer=InMemorySaver())

        app.state.guest_sessions = GuestSessions(guest_graph, app.state.run_manager._pool)

        async def reap_guests():
            while True:
                await asyncio.sleep(60)
                app.state.guest_sessions.reap()

        cleanup = asyncio.create_task(reap_guests())
        try:
            yield
        finally:
            cleanup.cancel()
            with suppress(asyncio.CancelledError):
                await cleanup
            app.state.guest_sessions.shutdown()
            app.state.run_manager.shutdown()
            if close_checkpointer is not None:
                close_checkpointer()
            engine.dispose()

    app = FastAPI(title="InvestAgent API", version="0.2.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    for router in (auth.router, runs.router, conversations.router, reports.router):
        app.include_router(router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
