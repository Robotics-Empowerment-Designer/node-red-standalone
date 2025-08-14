import qi
import logging

from flask_socketio import emit
from time import time

from ..server import app
from .connection_helper import connect

logger = logging.getLogger(__name__)

is_disconnected = False
session, connection_type = connect()
logger.info("Connection type: " + connection_type)
print("Connection type:", connection_type)

with app.test_request_context():
    emit("/update/connection_type", connection_type, broadcast=True, namespace="/")

def periodic_task():
    global is_disconnected
    global memory

    if not session.isConnected() and not is_disconnected:
        logger.error("Connection to robot lost")
        is_disconnected = True
        connection_type = "Disconnected"

if connection_type != "Disconnected":
    connection_task = qi.PeriodicTask()
    connection_task.setCallback(periodic_task)
    connection_task.setUsPeriod(1000000) # 10s
    connection_task.start(True)
