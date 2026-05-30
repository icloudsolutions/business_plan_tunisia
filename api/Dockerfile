FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY packages/bp_schema /app/packages/bp_schema
COPY packages/bp_calc /app/packages/bp_calc
RUN pip install --no-cache-dir /app/packages/bp_schema /app/packages/bp_calc

COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt

COPY api /app/api
ENV PYTHONPATH=/app/api:/app/packages/bp_schema:/app/packages/bp_calc

WORKDIR /app/api
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
