 # app creation

import logging
import traceback

from flask import Flask
from flask_socketio import SocketIO
from werkzeug.exceptions import HTTPException


app = Flask(__name__)
app.config["SECRET_KEY"] = "EVELYNN"

# cors header needed for esp connection
socketio = SocketIO(app, cors_allowed_origins="*")

logger = logging.getLogger(__name__)

@app.errorhandler(Exception)
def unhandled_exception(e):
    if isinstance(e, HTTPException):
        return e

    logger.critical(traceback.format_exc())
    return "Unhandled exception: See log for more info", 500
