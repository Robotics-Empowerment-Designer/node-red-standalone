import logging

from ...server import app, socketio

from flask import Response

logger = logging.getLogger(__name__)


@socketio.on("/")
@app.route("/", methods=["GET"])
def debug():
    return Response(status=200)
