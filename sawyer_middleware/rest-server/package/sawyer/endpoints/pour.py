import logging
import os
import socket
import time
import json

from flask import request, Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..index_error import handle_error
from ..bar import Bar

HOST = os.getenv('ROS_IP')
PORT = int(os.getenv('ROS_PORT'))

logger = logging.getLogger(__name__)

@socketio.on("/sawyer/pour")
@app.route("/sawyer/pour", methods=["POST"])
@log("/sawyer/pour")
def pour(data=None):
    while not Bar.startAction():
        time.sleep(1)

    if data:
        data = data.get("body")
        data = json.loads(data)
        print(data)
    else:
        emit(
            "/sawyer/pour/error",
            "ERROR : " + str(data) + " not found",
            broadcast=True,
            namespace="/",
        )
        return

    try:
        d = str(data[0])
        do = str(data[1])

        if d == None:
            return

        emit("/sawyer/pour/starting", "Pouring " + d + " to " + do, broadcast=True, namespace="/")

        cmd = "rosrun bartender_sawyer pour.py -d " + d + " -do " + do + ";rosrun bartender_sawyer parking.py"

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug(cmd)
        try:
            sock.sendall(cmd.encode('utf-8'))
            data = sock.recv(1024)
            response = data.decode('utf-8')

        finally:
            sock.close()

        status, try_again, infos = handle_error(response, allow_try_again=True, detailled_info=True)

        if status != "":
            if infos == "PRE_BOTTLE":
                if try_again:
                    emit("/sawyer/pour/2ndTry", status, broadcast=True, namespace="/")

                    cmd = "rosrun bartender_sawyer parking.py;" + cmd

            elif infos == "GO_TO_GLASS":
                emit("/sawyer/pour/forceReset", status, broadcast=True, namespace="/")

                cmd = "rosrun bartender_sawyer gripper_actions.py; rosrun bartender_sawyer parking.py"

            elif infos == "DEPOSIT_BOTTLE":
                emit("/sawyer/pour/forceReset", status, broadcast=True, namespace="/")

                cmd = "rosrun bartender_sawyer parking.py"

            else:
                emit("/sawyer/pour/finished", status, broadcast=True, namespace="/")
                Bar.stopAction()
                return Response(status=200)

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((HOST, PORT))
            try:
                sock.sendall(cmd.encode('utf-8'))
                data = sock.recv(1024)
                response = data.decode('utf-8')

            finally:
                sock.close()

            status, try_again = handle_error(response)

        Bar.stopAction()

        emit("/sawyer/pour/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        Bar.stopAction()
        return Response(str(e), status=400)

@socketio.on("/sawyer/pour+")
@app.route("/sawyer/pour+", methods=["POST"])
@log("/sawyer/pour+")
def pourAdv(data=None):
    while not Bar.startAction():
        time.sleep(1)

    try:
        d = str(data[0])
        do = str(data[1])

        emit("/sawyer/pour+/starting", "Pouring " + d + " to " + do, broadcast=True, namespace="/")

        cmd = "rosrun bartender_sawyer pour_with_detection.py -d " + d + " -do " + do

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        logger.debug(cmd)
        try:
            sock.sendall(cmd.encode('utf-8'))
            data = sock.recv(1024)
            response = data.decode('utf-8')

        finally:
            sock.close()

        logger.debug(response)
        status, try_again, infos = handle_error(response, allow_try_again=True, detailled_info=True)

        if status != "":
            if infos == "PRE_BOTTLE":
                if try_again:
                    emit("/sawyer/pour+/2ndTry", status, broadcast=True, namespace="/")

                    cmd = "rosrun bartender_sawyer parking.py;" + cmd

            elif infos == "GO_TO_GLASS":
                emit("/sawyer/pour+/forceReset", status, broadcast=True, namespace="/")

                cmd = "rosrun bartender_sawyer gripper_actions.py; rosrun bartender_sawyer parking.py"

            elif infos == "DEPOSIT_BOTTLE":
                emit("/sawyer/pour+/forceReset", status, broadcast=True, namespace="/")

                cmd = "rosrun bartender_sawyer parking.py"

            else:
                Bar.stopAction()
                emit("/sawyer/pour+/finished", status, broadcast=True, namespace="/")
                return Response(status=200)

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((HOST, PORT))
            try:
                sock.sendall(cmd.encode('utf-8'))
                data = sock.recv(1024)
                response = data.decode('utf-8')

            finally:
                sock.close()

            status, try_again = handle_error(response)

        Bar.stopAction()
        emit("/sawyer/pour+/finished", status, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        Bar.stopAction()
        return Response(str(e), status=400)
