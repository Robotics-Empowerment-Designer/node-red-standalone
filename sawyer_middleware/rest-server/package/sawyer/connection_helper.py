import qi
import logging
import os

import package.config as config

from ..utilities import get_ip, is_host_reachable

logger = logging.getLogger(__name__)

if not config.IP:
    config.IP = os.environ["ROBOT_IP_SAWYER"]

if not config.FLASK_IP:
    config.FLASK_IP = get_ip()

if not config.FLASK_PORT:
    config.FLASK_PORT = int(os.environ["FLASK_PORT"])

logger.info("Using {} as Flask server IP.".format(config.FLASK_IP))

def connect():
    logger.debug("Trying to connect to the robot with IP {} and port {}.".format(config.IP, config.PORT))
    
    if not is_host_reachable(config.IP, config.PORT):
        logger.info("The robot at {}:{} is not reachable.".format(config.IP, config.PORT))
        return None, "Disconnected"
    else:
        logger.debug("The robot at {}:{} is reachable.".format(config.IP, config.PORT))
    
    try:
    	return None, "Real robot"
    	logger.debug("Before qi.application")
    	sawyer = qi.Application(url="tcp://{}:{}".format(config.IP, config.PORT))
    	logger.debug("Before start")
    	sawyer.start()
    	logger.debug("After start")
    	session = sawyer.session
    	connection_type = "Real robot"
    	logger.debug("Connected to robot with ip {} and port {}.".format(config.IP, config.PORT))
    	return session, connection_type

        
    except RuntimeError as e:
        logger.debug("Can't connect to robot with ip {} and port {}.".format(config.IP, config.PORT))    
        return None, "Disconnected"
