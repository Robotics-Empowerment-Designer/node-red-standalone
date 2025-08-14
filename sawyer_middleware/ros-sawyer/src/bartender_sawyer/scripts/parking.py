#!/usr/bin/env python

import rospy
import intera_interface

def parking():
	rospy.init_node('hello')
	limb = intera_interface.Limb('right')
	
	limb.move_to_neutral()
	
	
if __name__ == '__main__':
	try:
		parking()
	except rospy.ROSInterruptException:
		pass
