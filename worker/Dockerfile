FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY packages/bp_schema /app/packages/bp_schema
COPY packages/bp_calc /app/packages/bp_calc
RUN pip install --no-cache-dir /app/packages/bp_schema /app/packages/bp_calc

COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt
RUN pip install --no-cache-dir openpyxl reportlab redis

COPY api/app /app/api/app
COPY worker /app/worker

ENV PYTHONPATH=/app/worker:/app/api:/app/packages/bp_schema:/app/packages/bp_calc

WORKDIR /app/worker
CMD ["celery", "-A", "worker.celery_app", "worker", "--loglevel=info", "-Q", "calc,export", "--concurrency=2"]
