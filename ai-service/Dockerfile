# ---- builder stage ----
FROM python:3.18-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc-dev && rm -rf /var/lib/apt/lists/*

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime stage ----
FROM python:3.18-slim AS runtime
WORKDIR /app

# libgomp1 is required by LightGBM at runtime
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

# Copy only the pre-built venv — no gcc, no build caches in final image
COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY main.py .
COPY src/ ./src/

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
