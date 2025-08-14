#!/usr/bin/env python

import rospy
import intera_interface

def initialisation():
	rospy.init_node('init')
	
	HeadDisplay = intera_interface.HeadDisplay()
	RobotEnable = intera_interface.RobotEnable()
	Gripper = intera_interface.Gripper()
	Limb = intera_interface.Limb()
	
	try:
		RobotEnable.enable()
	except:
		rospy.logerr("ROBOT_NOT_ENABLE")
		exit(1)
	
	Gripper.calibrate()
	Gripper.open()
	
	if not Gripper.is_ready():
		rospy.logerr("GRIPPER_NOT_READY")
	
	Limb.move_to_neutral()
	
	HeadDisplay.display_image('/img/background.png')
	exit(0)
	
if __name__ == '__main__':
	try:
		initialisation()
	except rospy.ROSInterruptException as e:
		rospy.logerr("GLOBAL") #Basic error
		exit(1)
