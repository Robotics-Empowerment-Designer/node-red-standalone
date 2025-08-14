# FROM python:3.5.10-slim-buster
FROM python:3.6
WORKDIR /home/

RUN apt-get update -y && \
    apt-get install curl -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip==20.3.4 && \
    pip install --no-cache-dir -r requirements.txt && \
    rm requirements.txt

EXPOSE 5000
EXPOSE 8000

CMD ["bash", "/home/run.sh"]
