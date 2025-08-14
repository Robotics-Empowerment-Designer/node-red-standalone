#!/usr/bin/env python

import rospy
import intera_interface
import argparse

parser = argparse.ArgumentParser()

rospy.init_node('camera')

camera = ['head_camera', 'right_hand_camera']

def lights():
	
	args = parser.parse_args()
	
	Camera = intera_interface.Cameras()
	
	print(Camera.is_camera_streaming(camera[0]))
	print(Camera.is_camera_streaming(camera[0]))
	exit(0)
	

if __name__ == '__main__':
	try:
		lights()
	except rospy.ROSInterruptException as e:
		rospy.logerr("GLOBAL") #Basic error
		exit(1)
