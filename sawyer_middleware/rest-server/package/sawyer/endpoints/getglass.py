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

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)


@socketio.on("/sawyer/getglass")
#@app.route("/sawyer/getglass", methods=["POST"])
@log("/sawyer/getglass")
def getglass(data=None):
    if data:
        data = data.get("body")
        data = json.loads(data)
        print(f"getGlass data:{data}")
    else:
        emit(
            "/sawyer/getglass/error",
            "ERROR : " + str(data) + " not found",
            broadcast=True,
            namespace="/",
        )
        return

    while not Bar.startAction():
        time.sleep(1)

    try:
        pu = str(data[0])
        do = str(data[1])

        emit(
            "/sawyer/getglass/starting",
            "Taking glass from " + pu + " to " + do,
            broadcast=True,
            namespace="/",
        )

        cmd = (
            "rosrun bartender_sawyer get_glass.py -pu "
            + pu
            + " -do "
            + do
            + ";rosrun bartender_sawyer parking.py"
        )

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        status, try_again = handle_error(response, allow_try_again=True)

        if try_again:
            emit("/sawyer/getglass/2ndTry", status, broadcast=True, namespace="/")

            cmd = "rosrun bartender_sawyer parking.py; " + cmd

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((HOST, PORT))

            try:
                sock.sendall(cmd.encode("utf-8"))
                data = sock.recv(1024)
                response = data.decode("utf-8")

            finally:
                sock.close()

            status, try_again = handle_error(response)

        print(f"getglass, status at end: {status}")

        Bar.stopAction()
        emit("/sawyer/getglass/finished", status, broadcast=True, namespace="/")
        return Response(status=200)
    except Exception as e:
        logger.error(e)
        Bar.stopAction()
        return Response(str(e), status=400)


# @socketio.on("/sawyer/getglass+")
# @app.route("/sawyer/getglass+", methods=["POST"])
# @log("/sawyer/getglass+")
# def getglassAdvanced(data=None):
#     if data:
#         data = data.get("body")
#         data = json.loads(data)
#         print(data)
#     else:
#         emit(
#             "/sawyer/getglass+/error",
#             "ERROR : " + str(data) + " not found",
#             broadcast=True,
#             namespace="/",
#         )
#         return
#
#     while not Bar.startAction():
#         time.sleep(1)
#
#     Bar.setNoGlassPosition(True)
#
#     try:
#         do = str(data[0])
#
#         emit(
#             "/sawyer/getglass+/starting",
#             "Taking glass to " + do,
#             broadcast=True,
#             namespace="/",
#         )
#
#         cmd = "rosrun bartender_sawyer get_glass_with_detection.py -do " + do
#
#         sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#         sock.connect((HOST, PORT))
#
#         logger.debug(cmd)
#         try:
#             sock.sendall(cmd.encode("utf-8"))
#             data = sock.recv(1024)
#             response = data.decode("utf-8")
#
#         finally:
#             sock.close()
#
#         status = ""
#         status, try_again, infos = handle_error(
#             response, allow_try_again=True, detailled_info=True
#         )
#
#         if status != "":
#             if infos == "PRE_BOTTLE":
#                 if try_again:
#                     emit(
#                         "/sawyer/getglass+/2ndTry",
#                         status,
#                         broadcast=True,
#                         namespace="/",
#                     )
#
#                     cmd = "rosrun bartender_sawyer parking.py;" + cmd
#
#             elif infos == "GO_TO_GLASS":
#                 emit(
#                     "/sawyer/getglass+/forceReset",
#                     status,
#                     broadcast=True,
#                     namespace="/",
#                 )
#
#                 cmd = "rosrun bartender_sawyer gripper_actions.py; rosrun bartender_sawyer parking.py"
#
#             elif infos == "DEPOSIT_BOTTLE":
#                 emit(
#                     "/sawyer/getglass+/forceReset",
#                     status,
#                     broadcast=True,
#                     namespace="/",
#                 )
#
#                 cmd = "rosrun bartender_sawyer parking.py"
#
#             else:
#                 Bar.stopAction()
#                 emit(
#                     "/sawyer/getglass+/finished", status, broadcast=True, namespace="/"
#                 )
#                 return Response(status=200)
#
#             sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#             sock.connect((HOST, PORT))
#             try:
#                 sock.sendall(cmd.encode("utf-8"))
#                 data = sock.recv(1024)
#                 response = data.decode("utf-8")
#
#             finally:
#                 sock.close()
#
#             status, try_again = handle_error(response)
#
#         emit("/sawyer/getglass+/finished", status, broadcast=True, namespace="/")
#         Bar.stopAction()
#         return Response(status=200)
#     except Exception as e:
#         logger.error(e)
#         Bar.stopAction()
#         return Response(str(e), status=400)
