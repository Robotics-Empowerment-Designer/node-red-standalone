import logging
import json

from flask import Response
from flask_socketio import emit

from ...server import app, socketio
from ...decorator import log
from ..bar import Bar


logger = logging.getLogger(__name__)


@socketio.on("/sawyer/restocking")
@app.route("/sawyer/restocking", methods=["POST"])
@log("/sawyer/restocking")
def restocking(data=None):
    try:
        if data:
            data = data.get("body")
            data = json.loads(data)
            print(data)
        else:
            emit(
                "/sawyer/restocking/error",
                "ERROR : " + str(data) + " not found",
                broadcast=True,
                namespace="/",
            )
            return

        Bar.resetGlass(int(data[0]) - 1)

        emit("/sawyer/restocking/finished", "", broadcast=True, namespace="/")

        return Response(status=200)
    except Exception as e:
        logger.error(e)
        return Response(str(e), status=400)
