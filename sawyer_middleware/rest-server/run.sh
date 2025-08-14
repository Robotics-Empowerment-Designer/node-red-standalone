#!/bin/sh

 gunicorn \
 --worker-class eventlet \
 -w 1 \
 -b 0.0.0.0:${FLASK_PORT} \
 --reload app:app
