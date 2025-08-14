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


@socketio.on("/sawyer/lights")
@app.route("/sawyer/lights", methods=["POST"])
@log("/sawyer/lights")
def lights(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            print(data)
        else:
            emit(
                "/sawyer/lights/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        logger.debug("Reçu de node-red")
        power = data[1]
        led = data[0]

        cmd = "rosrun bartender_sawyer lights.py -l " + led + " -p " + power

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug("emi")

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        logger.debug("Reçu rep")

        status, try_again = handle_error(response)

        emit("/sawyer/lights/finished", status, broadcast=True, namespace="/")

        logger.debug("Renvoyé")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
