#!/usr/bin/env python

import rospy
import intera_interface
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-p','--power', type=str, help='New powerState')
parser.add_argument('-l','--led', type=str, help='Name of LED')


rospy.init_node('lights')

def lights():
	
	args = parser.parse_args()
	
	if not args.power:
		rospy.logerr("BAD_INPUT POWER")
		exit(1)

	if not args.led:
		rospy.logerr("BAD_INPUT LED")
		exit(1)
	
	Lights = intera_interface.Lights()
	
	powerState = False
	if args.power == "on":
		powerState = True	

	
	Lights.set_light_state(args.led,powerState)
	exit(0)


if __name__ == '__main__':
	try:
		lights()
	except rospy.ROSInterruptException as e:
		rospy.logerr("GLOBAL") #Basic error code
		exit(1)
