#Initialization of the log file for debugging


import logging
import logging.handlers
import package.config as config

if not config.LOG_PATH:
    config.LOG_PATH = "sawyer.log"

logging.basicConfig(filename=config.LOG_PATH,
                    level=logging.DEBUG,
                    format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s.%(funcName)s: %(message)s",
                    datefmt="%d.%m.%Y %H:%M:%S")

logging.getLogger("socketio").setLevel(logging.ERROR)
logging.getLogger("engineio").setLevel(logging.ERROR)
logging.getLogger("werkzeug").setLevel(logging.ERROR)
