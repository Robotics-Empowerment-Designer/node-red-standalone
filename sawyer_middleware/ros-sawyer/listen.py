#!/usr/bin/env python
import socket
import subprocess
import logging
import logging.handlers
import os
import signal
import time

class GracefulKiller:
	kill_now = False
	
	def __init__(self):
		signal.signal(signal.SIGINT, self.exit_gracefully)
		signal.signal(signal.SIGTERM, self.exit_gracefully)
		
	def exit_gracefully(self,sigmum, frame):
		self.kill_now = True

LOG_PATH = "ros-sawyer.log"

HOST = os.getenv('ROS_IP')
PORT = int(os.getenv('ROS_PORT'))



try:

	sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	sock.bind((HOST, PORT))
	sock.listen()
	print("Connexion with Rest-Server OK")

except:
	print("ERROR : Connexion with Rest-Server impossible. Try to relaunch the app")


killer = GracefulKiller()
while True:
	#Waiting for connection
	connection, client_address = sock.accept()
	
	try:
		
		command = connection.recv(1024).decode()
		
		#Setup env for the command
		commands = "source /devel/setup.bash; " + command
		
		process = subprocess.Popen(commands,stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True,executable='/bin/bash')

		output, error = process.communicate()
		response = error.decode()

		connection.sendall(response.encode('utf-8'))
		
	finally:
		connection.close()
		
	if killer.kill_now:
		sock.close()
		break
		
	


