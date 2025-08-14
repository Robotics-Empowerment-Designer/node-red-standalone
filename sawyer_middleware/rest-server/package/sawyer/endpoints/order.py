import logging
import os
import socket
import time
import json

from flask import Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..index_error import handle_error
from ..bar import Bar

HOST = os.getenv("ROS_IP")
PORT = int(os.getenv("ROS_PORT"))

logger = logging.getLogger(__name__)

@socketio.on("/sawyer/manage_order")
@app.route("/sawyer/manage_order", methods=["POST"])
@log("/sawyer/manage_order")
def manage_order(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            print(f"manage_order: {data}")
        else:
            emit(
                "/sawyer/manage_order/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        mess = data[0]
        l = mess.split(",")
        num = l[0]
        order = l[1]

        if num == "reset":
            Bar.reset(hard=True)
            emit("/sawyer/manage_order/finished", "None", broadcast=True, namespace="/")
            return Response(status=200)

        Bar.receiveOrder(num)

        attendre = True
        while attendre:
            n, ready = Bar.checkNextOrder()
            if (num == n) and ready:
                if Bar.getReady():
                    attendre = False
            if attendre:
                time.sleep(5)

        startpos, endpos = Bar.prepareNextOrder()

        msg = {
            "num": num,
            "endpos": endpos + 1,
            "order": order,
            "startpos": startpos + 1,
        }

        emit("/sawyer/manage_order/finished", msg, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)


@socketio.on("/sawyer/order_ready")
@app.route("/sawyer/order_ready", methods=["POST"])
@log("/sawyer/order_ready")
def order_ready(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            # print(data)
        else:
            emit(
                "/sawyer/order_ready/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        num = data[0]
        host = data[1]
        port = data[2]

        Bar.setReady(num)

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((str(host), int(port)))

        try:
            sock.sendall(num.encode("utf-8"))
        finally:
            sock.close()

        emit("/sawyer/order_ready/finished", "", broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)


@socketio.on("/sawyer/give_order")
@app.route("/sawyer/give_order", methods=["POST"])
@log("/sawyer/give_order")
def give_order(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            # print(data)
        else:
            emit(
                "/sawyer/give_order/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        num = data[0]
        topic = data[1]

        pos = Bar.getSlot(num) + 1

        while not Bar.startAction(prior=True):
            time.sleep(3)

        emit("/sawyer/give_order/starting", str(num), broadcast=True, namespace="/")

        if pos == 0:
            Bar.freePrior()
            Bar.stopAction()
            emit(
                "/sawyer/give_order/error",
                "ERROR : " + str(num) + " not found",
                broadcast=True,
                namespace="/",
            )

        #cmd = "rosrun bartender_sawyer give_order.py -pu " + str(pos)
        # Because I placed it on TEMI
        cmd = "rosrun bartender_sawyer parking.py"

        # PRIORISER AVEC UN AUTRE SEMAPHORE DE SERVIR LE BARMAN EN PREMIER AVANT DE CONTINUER LES AUTRES COMMANDES

        logger.debug(cmd)
        # BLABLA ENVOYER LA COMMANDE A ROS
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))
        try:
            sock.sendall(cmd.encode("utf-8"))
            data = sock.recv(1024)
            response = data.decode("utf-8")

        finally:
            sock.close()

        logger.debug(response)
        status, try_again = handle_error(response)

        Bar.freeSlot(num)

        if Bar.getNoGlassPosition():
            Bar.resetGlass(pos - 1)

        # RENDRE LA PRIO

        Bar.freePrior()
        Bar.stopAction()

        msg = {"payload": num, "topic": topic}

        emit("/sawyer/give_order/finished", msg, broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
