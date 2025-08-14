import logging

from flask import request, Response

from ...server import app, socketio


@socketio.on("/sawyer/log")
@app.route("/sawyer/log", methods=["POST"])
def log_message(data=None):
    try:
        if data:
            level, message = data
            serviceName = request.headers.get("serviceName")
        else:
            level = request.json["level"]
            message = request.json["message"]
            serviceName = request.json["serviceName"]

        logger = logging.getLogger(serviceName)
        logger.log(level, "{} {}".format(request.remote_addr, message))

        return Response(status=200)
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(e)

        return Response(status=500)
