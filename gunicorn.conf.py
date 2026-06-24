import multiprocessing
import os


def env_int(name, default, lo, hi):
    try:
        value = int(os.environ.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(lo, min(hi, value))


cpu_count = multiprocessing.cpu_count() or 1
bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = env_int("WEB_CONCURRENCY", 1, 1, 4)
threads = env_int("GUNICORN_THREADS", max(4, min(8, cpu_count * 2)), 1, 16)
timeout = env_int("GUNICORN_TIMEOUT", 120, 30, 300)
graceful_timeout = env_int("GUNICORN_GRACEFUL_TIMEOUT", 30, 10, 120)
keepalive = env_int("GUNICORN_KEEPALIVE", 5, 1, 30)
max_requests = env_int("GUNICORN_MAX_REQUESTS", 1200, 0, 10000)
max_requests_jitter = env_int("GUNICORN_MAX_REQUESTS_JITTER", 120, 0, 1000)
worker_class = "gthread"
worker_tmp_dir = os.environ.get("GUNICORN_WORKER_TMP_DIR", "/tmp")
preload_app = os.environ.get("GUNICORN_PRELOAD", "0") == "1"
