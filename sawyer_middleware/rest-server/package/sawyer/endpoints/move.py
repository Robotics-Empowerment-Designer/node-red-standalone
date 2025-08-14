import logging
import os
import socket
import json

from flask import request, Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..index_error import trajectory_error

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)


@socketio.on("/sawyer/move_j")
@app.route("/sawyer/move_j", methods=["POST"])
@log("/sawyer/move_j")
def move_j(data=None):
    if data:
        data = data.get("body")
        data = json.loads(data)
        print(data)
    else:
        emit(
            "/sawyer/move_j/error",
            "ERROR : " + str(data) + " not found",
            broadcast=True,
            namespace="/",
        )
        return

    if len(data) != 8:
        emit("/sawyer/move_j/finished", "error", broadcast=True, namespace="/")
        return Response(status=400)

    s = "rosrun bartender_sawyer move.py -j "
    for i in range(7):
        s = s + " " + str(data[i])

    cmd = s + " -ls " + data[7]

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug(cmd)

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        status = ""
        if response != "":
            errors = response.split("\n")
            for error in errors:
                tab_error = error.split(" ")
                if len(tab_error) < 3:
                    continue
                if tab_error[2] == "BAD_INPUT":
                    status = (
                        status
                        + "BAD INPUT "
                        + tab_error[3]
                        + ". Verify your settings.\n"
                    )
                elif tab_error[2] == "TRAJECTORY_ERROR":
                    status = (
                        status + "TRAJECTORY ERROR during " + tab_error[3] + " movement"
                    )
                    if tab_error[4] in trajectory_error:
                        status = status + ". " + trajectory_error[tab_error[4]]
                    status = status + ".\n"
                else:
                    status = status + tab_error[2] + "\n"

        emit("/sawyer/move_j/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)


@socketio.on("/sawyer/move_s")
@app.route("/sawyer/move_s", methods=["POST"])
@log("/sawyer/move_s")
def move_s(data=None):
    if data:
        data = data.get("body")
        data = json.loads(data)
        print(data)
    else:
        emit(
            "/sawyer/move_s/error",
            "ERROR : " + str(data) + " not found",
            broadcast=True,
            namespace="/",
        )
        return

    if len(data) != 11:
        emit("/sawyer/move_s/finished", "error", broadcast=True, namespace="/")
        return Response(status=400)

    s = "rosrun bartender_sawyer move.py -s "
    for i in range(7):
        s = s + " " + str(data[i])

    cmd = (
        s
        + " -ls "
        + data[7]
        + " -la "
        + data[8]
        + " -rs "
        + data[9]
        + " -ra "
        + data[10]
    )

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug(cmd)

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        status = ""
        if response != "":
            errors = response.split("\n")
            for error in errors:
                tab_error = error.split(" ")
                if len(tab_error) < 3:
                    continue
                if tab_error[2] == "BAD_INPUT":
                    status = (
                        status
                        + "BAD INPUT "
                        + tab_error[3]
                        + ". Verify your settings.\n"
                    )
                elif tab_error[2] == "TRAJECTORY_ERROR":
                    status = (
                        status + "TRAJECTORY ERROR during " + tab_error[3] + " movement"
                    )
                    if tab_error[4] in trajectory_error:
                        status = status + ". " + trajectory_error[tab_error[4]]
                    status = status + ".\n"
                else:
                    status = status + tab_error[2] + "\n"

        emit("/sawyer/move_s/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)


@socketio.on("/sawyer/move_r")
@app.route("/sawyer/move_r", methods=["POST"])
@log("/sawyer/move_r")
def move_r(data=None):
    if data:
        data = data.get("body")
        data = json.loads(data)
        print(data)
    else:
        emit(
            "/sawyer/move_r/error",
            "ERROR : " + str(data) + " not found",
            broadcast=True,
            namespace="/",
        )
        return

    if len(data) != 11:
        emit("/sawyer/move_r/finished", "error", broadcast=True, namespace="/")
        return Response(status=400)

    s = "rosrun bartender_sawyer move.py -r "
    for i in range(6):
        s = s + " " + str(data[i])

    if data[6] == "Tool":
        s = s + " -T "

    cmd = (
        s
        + " -ls "
        + data[7]
        + " -la "
        + data[8]
        + " -rs "
        + data[9]
        + " -ra "
        + data[10]
    )

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug(cmd)

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        logger.debug(response)
        status = ""
        if response != "":
            errors = response.split("\n")
            for error in errors:
                tab_error = error.split(" ")
                if len(tab_error) < 3:
                    continue
                if tab_error[2] == "BAD_INPUT":
                    status = (
                        status
                        + "BAD INPUT "
                        + tab_error[3]
                        + ". Verify your settings.\n"
                    )
                elif tab_error[2] == "TRAJECTORY_ERROR":
                    status = (
                        status + "TRAJECTORY ERROR during " + tab_error[3] + " movement"
                    )
                    if tab_error[4] in trajectory_error:
                        status = status + ". " + trajectory_error[tab_error[4]]
                    status = status + ".\n"
                else:
                    status = status + tab_error[2] + "\n"

        emit("/sawyer/move_r/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
