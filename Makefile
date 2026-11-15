BACKEND_PY ?= backend/.venv/bin/python

.PHONY: backend-install backend-test backend-lint backend-run

backend-install:
	cd backend && python3.12 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt

backend-test:
	cd backend && .venv/bin/python -m pytest -q

backend-lint:
	cd backend && .venv/bin/python -m ruff check src/ tests/ api/ && .venv/bin/python linters/check_agent_structure.py

backend-run:
	cd backend && .venv/bin/python -m streamlit run app/streamlit_app.py
