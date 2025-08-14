import logging
import os
import socket
import numpy as np
import json

from PIL import Image, ImageFont, ImageDraw
from flask import request, Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..index_error import handle_error
from ..bar import Bar

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)
logging.getLogger("PIL").setLevel(logging.ERROR)

height = 600
width = 1024

font = ImageFont.truetype("/img/ArialCE.ttf", 32)


@socketio.on("/sawyer/display")
@app.route("/sawyer/display", methods=["POST"])
@log("/sawyer/display")
def display(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            #print(data)
        else:
            emit(
                "/sawyer/display/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))

        cmd = "rosrun bartender_sawyer display.py -u " + data[0]

        if data[1]:
            cmd = cmd + " -r " + data[1]

        if data[2] == "True":
            cmd = cmd + " -l"

        logger.debug(cmd)

        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        status, try_again = handle_error(response)

        emit("/sawyer/display/finished", status, broadcast=True, namespace="/")
        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)


@socketio.on("/sawyer/display_order")
@app.route("/sawyer/display_order", methods=["POST"])
@log("/sawyer/display_order")
def display_order(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
        else:
            emit(
                "/sawyer/display_order/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        num = data[0]
        drink = data[1]
        end = data[2]

        if num == "reset":
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((HOST, PORT))
            cmd = "rosrun bartender_sawyer display.py -u /img/background.png"

            try:
                sock.sendall(cmd.encode("utf-8"))
                data = sock.recv(1024)
                response = data.decode("utf-8")

            finally:
                sock.close()
            emit("/sawyer/display/finished", "", broadcast=True, namespace="/")

            return Response(status=200)

        tab_order = Bar.majDisplayingList(num, drink, end)
        print(f"Tab order: {tab_order}")

        image = Image.open("/img/background.png")
        draw = ImageDraw.Draw(image)
        ligne = 200

        for order in tab_order[0:4]:
            draw.text((100, ligne + 30), order["num"], font=font, fill=(0, 0, 0))
            e = "-"
            if order["pos"] != 0:
                e = str(order["pos"])
            draw.text((650, ligne + 30), e, font=font, fill=(0, 0, 0))
            ligne += 100

        ligne = 200

        background = np.array(image)

        for order in tab_order[0:4]:
            background[ligne + 10 : ligne + 90, 280:360] = np.array(
                Image.open(order["drink"])
            )
            background[ligne + 10 : ligne + 90, 800:1000] = np.array(
                Image.open(order["state"])
            )
            background[ligne, :, :] = 0
            ligne += 100

        pil_img = Image.fromarray(background)
        pil_img.save("/img/display.png")

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))
        cmd = "rosrun bartender_sawyer display.py -u /img/display.png"

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
                else:
                    status = status + tab_error[2] + "\n"

        emit("/sawyer/display_order/finished", "", broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
