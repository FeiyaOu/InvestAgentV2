# InvestAgent API image: core library + FastAPI service layer.
# Build context is backend/. Mirrors default to Aliyun for builds from China; CI passes the official sources.
FROM python:3.12-slim AS base

ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ARG APT_MIRROR=mirrors.aliyun.com
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL}

# libstdc++/libatomic for the MiniRacer (V8) wheel used by akshare's Sina decoder; curl for healthchecks.
RUN if [ -n "${APT_MIRROR}" ]; then sed -i "s#deb.debian.org#${APT_MIRROR}#g" /etc/apt/sources.list.d/debian.sources; fi \
    && apt-get update && apt-get install -y --no-install-recommends libstdc++6 libatomic1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements-api.txt ./
RUN --mount=type=cache,target=/root/.cache/pip pip install --timeout 120 --retries 10 -r requirements-api.txt

# Runtime code only: tests, Streamlit shell and specs stay out of the image.
COPY src ./src
COPY api ./api
COPY services ./services
COPY research_skills ./research_skills
COPY alembic.ini ./
COPY alembic ./alembic
COPY docker-entrypoint.sh ./
RUN mkdir -p runtime/reports && chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 10001 app && chown -R app:app /app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
