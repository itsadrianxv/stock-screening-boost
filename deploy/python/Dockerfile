FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY python_services/requirements.txt ./requirements.txt
COPY deploy/python/vendor ./vendor
RUN pip install --no-cache-dir -r requirements.txt \
  && found=0 \
  && for pkg in vendor/*.whl vendor/*.tar.gz vendor/*.zip; do \
    if [ -f "$pkg" ]; then \
      echo "Installing vendor Python package: $pkg"; \
      pip install --no-cache-dir "$pkg"; \
      found=1; \
    fi; \
  done \
  && if [ "$found" -eq 0 ]; then \
    echo "No vendor iFinD package provided; continuing without iFinDPy."; \
  fi \
  && rm -rf vendor

COPY python_services/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
