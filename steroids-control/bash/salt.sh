#!/bin/bash

echo "Switching to Salt..."
echo ""

systemctl stop node-red.service
cp /home/team/git/multi-node-red/docker-compose_salt.yml /home/team/git/multi-node-red/docker-compose_current.yml
systemctl start node-red.service
systemctl status node-red.service

echo "salt" > current.txt
