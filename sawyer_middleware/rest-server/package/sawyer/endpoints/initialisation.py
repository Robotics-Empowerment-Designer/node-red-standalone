import logging
import os
import socket
import json

from ...server import app, socketio
from ...decorator import log

from flask import request, Response
from flask_socketio import emit
from ..index_error import handle_error

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)


@socketio.on("/sawyer/init")
@app.route("/sawyer/init", methods=["POST"])
@log("/sawyer/init")
def initialisation(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            print(data)
        else:
            emit(
                "/sawyer/init/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        cmd = "rosrun bartender_sawyer initialisation.py"

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")
        finally:
            sock.close()

        status, try_again = handle_error(response)

        emit("/sawyer/init/finished", status, broadcast=True, namespace="/")
        Bar.reset()

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
