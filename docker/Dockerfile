FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV PUBLIC_BASE_PATH=/minecraft-tools/Seed-Viewer
ENV PUBLIC_PERF_MODE=server
ENV WEB_CONCURRENCY=1
ENV GUNICORN_THREADS=4
ENV GUNICORN_TIMEOUT=120

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py cubiomes_wrapper.c libseedmap.so ./
COPY templates ./templates
COPY static ./static

RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s%s/api/versions' % (os.environ.get('PORT', '8080'), os.environ.get('PUBLIC_BASE_PATH', '')), timeout=3).read()"

CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT} --workers ${WEB_CONCURRENCY} --threads ${GUNICORN_THREADS} --timeout ${GUNICORN_TIMEOUT}"]
