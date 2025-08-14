import logging
import os
import socket
import json

from flask import request, Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..index_error import handle_error

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)


@socketio.on("/sawyer/grip")
@app.route("/sawyer/grip", methods=["POST"])
@log("/sawyer/grip")
def grip(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            print(data)
        else:
            emit(
                "/sawyer/grip/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        logger.debug(data)
        cmd = "rosrun bartender_sawyer gripper_actions.py"
        if data == ["close"]:
            cmd = cmd + " -c"

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug(cmd)
        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        status, try_again = handle_error(response)

        emit("/sawyer/grip/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
