import logging
import traceback
import sys

from package.logger import *

logger = logging.getLogger(__name__)

print("""
Sawyer Bartender, by Loan BERNAT
""")
try:
	from package.sawyer.connection_helper import *
	from package.server import *
	from package.socket import *
	from package.sawyer.connection import *
	
	from package.sawyer.index_error import *
	from package.sawyer.bar import *
	
	from package.sawyer.endpoints.test import *
	from package.sawyer.endpoints.debug import *
	from package.sawyer.endpoints.getpos import *
	from package.sawyer.endpoints.grip import *
	from package.sawyer.endpoints.getglass import *
	from package.sawyer.endpoints.pour import *
	from package.sawyer.endpoints.order import *
	from package.sawyer.endpoints.display import *
	from package.sawyer.endpoints.lights import *
	from package.sawyer.endpoints.initialisation import *
	from package.sawyer.endpoints.move import *
	from package.sawyer.endpoints.restocking import *
	
	
except Exception as e:
    logger.critical(traceback.format_exc())
    logger.critical("Exiting application due to unhandled exception")
    sys.exit(4)
