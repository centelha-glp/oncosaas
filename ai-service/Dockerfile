# ---- builder stage ----
FROM python:3.11.15-slim-bookworm AS builder
WORKDIR /app

ENV PATH="/venv/bin:$PATH" \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Keep image small, but still patch Debian packages
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends gcc libc-dev \
    && rm -rf /var/lib/apt/lists/*

# Trivy also scans global site-packages from the base image
RUN python -m pip install --upgrade \
    pip \
    setuptools==82.0.1 \
    wheel==0.46.3

RUN python -m venv /venv

COPY requirements.txt .
RUN /venv/bin/pip install --upgrade \
      pip \
      setuptools==82.0.1 \
      wheel==0.46.3 \
    && /venv/bin/pip install -r requirements.txt

# ---- runtime stage ----
FROM python:3.11.15-slim-bookworm AS runtime
WORKDIR /app

ENV PATH="/venv/bin:$PATH" \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# This is the important part for your CRITICAL OS findings
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Clear vulnerable global packaging tools reported by Trivy
RUN python -m pip install --upgrade \
    pip \
    setuptools==82.0.1 \
    wheel==0.46.3

COPY --from=builder /venv /venv

COPY main.py .
COPY src/ ./src/

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]