#!/usr/bin/env python

import rospy
import intera_interface
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-c','--close', action='store_true',help="-c to Close the gripper, nothing to open")

rospy.init_node('gripper_actions')
grip = intera_interface.Gripper()

def grip_actions():
	
	args = parser.parse_args()
	
	if not grip.is_ready():
		rospy.logerr("GRIP_NOT_READY")
		exit(1)
	
	if args.close:
		grip.close()
	else:
		grip.open()
	exit(0)

if __name__ == '__main__':
	try:
		grip_actions()
	except rospy.ROSInterruptException as e:
		rospy.logerr("GLOBAL") #Basic error
		exit(1)
