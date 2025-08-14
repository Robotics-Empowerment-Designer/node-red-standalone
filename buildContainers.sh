#!/bin/sh

# build Node-RED container
docker build -t node-red node-red/

# create data folder for Node-RED
mkdir -p node-red/data

# give container write permissions
chmod 777 node-red/data
chown 1000 node-red/data

