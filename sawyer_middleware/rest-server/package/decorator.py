import logging

from flask import request, has_request_context
from functools import wraps


def log(path):
    def decorate(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not has_request_context():
                return handle_method_call(func, args, kwargs)
            return handle_socketio(path, func, args, kwargs)

        return wrapper

    return decorate


def handle_method_call(func, args, kwargs):
    logger = logging.getLogger("{}.{}".format(func.__module__, func.__name__))

    logger.debug("{}.{}".format(args, kwargs))
    return func(*args, **kwargs)


def handle_socketio(path, func, args, kwargs):
    # Socket.IO context
    parameter = args

    # HTTP context
    if request.is_json:
        parameter = request.get_json()
    else:
        parameter = request.data.decode("utf-8")

    logger = logging.getLogger("{}.{}".format(func.__module__, func.__name__))
    logger.debug("{} {} {}".format(request.remote_addr, path, parameter))

    return func(*args, **kwargs)
