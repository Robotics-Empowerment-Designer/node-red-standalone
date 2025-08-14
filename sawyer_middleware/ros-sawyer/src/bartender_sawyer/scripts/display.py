#!/usr/bin/env python

import rospy
import intera_interface
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-u','--url', type=str, help='Image(s) Path')
parser.add_argument('-l','--loop', type=str, help='Looping or not')
parser.add_argument('-r','--rate', type=float, help='Display rate')

def display():
	rospy.init_node('display')
	args = parser.parse_args()
	
	if not args.url:
		rospy.logerr("BAD_INPUT file_path")
		exit(1)

	looping = False
	rate = 1.0
	
	if args.loop == "True":
		looping = True
	
	if args.rate:
		rate = args.rate
	
	screen = intera_interface.HeadDisplay()
	screen.display_image(args.url,display_in_loop=looping,display_rate=rate)
	
	exit(0)
	
if __name__ == '__main__':
	try:
		display()
	except rospy.ROSInterruptException as e:
		rospy.logerr("GLOBAL") #Basic error code
		exit(1)
