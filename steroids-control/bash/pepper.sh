#!/bin/bash

echo "Switching to Pepper..."
echo ""

systemctl stop node-red.service
cp /home/team/git/multi-node-red/docker-compose_pepper.yml /home/team/git/multi-node-red/docker-compose_current.yml
systemctl start node-red.service
systemctl status node-red.service

echo "pepper" > current.txt
