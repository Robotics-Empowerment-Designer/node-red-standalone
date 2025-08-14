import logging
import os
import socket

from flask import Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..index_error import handle_error

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)

@socketio.on("/sawyer/getpos")
@app.route("/sawyer/getpos", methods=["POST"])
@log("/sawyer/getpos")
def getpos(data=None):
    try:
        logger.debug(data)
        cmd = "rosrun bartender_sawyer get_pos.py"

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
        print(data)

        emit("/sawyer/getPos/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
