import logging
import os
import socket
import subprocess

from flask import request, Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)


@socketio.on("/sawyer/test")
@app.route("/sawyer/test", methods=["POST"])
@log("/sawyer/test")
def test(data=None):
    try:
        if data:
            text = data
        else:
            text = request.json["text"]

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))
        cmd = text[0]
        logger.debug(cmd)
        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        logger.debug(response)
        emit("/sawyer/test/finished", "", broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
