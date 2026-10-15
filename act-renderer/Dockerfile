FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /app

COPY requirements.txt ./

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      fontconfig \
      fonts-liberation=1:2.1.5-3 \
      libreoffice-writer=4:24.2.7-0ubuntu0.24.04.7 \
      python3 \
      python3-venv \
    && python3 -m venv /opt/renderer-venv \
    && /opt/renderer-venv/bin/pip install --no-cache-dir -r requirements.txt \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /usr/sbin/nologin renderer \
    && chown -R renderer:renderer /app /opt/renderer-venv

COPY --chown=renderer:renderer render_act.py main.py ./
COPY --chown=renderer:renderer templates/ ./templates/

USER renderer
EXPOSE 8080
CMD ["/opt/renderer-venv/bin/python", "main.py"]
