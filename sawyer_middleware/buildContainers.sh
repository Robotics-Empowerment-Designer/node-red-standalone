#!/bin/sh

# build rest-server container
docker build -t rest-server rest-server/

# build ROS container
docker build -t ros-sawyer ros-sawyer/
