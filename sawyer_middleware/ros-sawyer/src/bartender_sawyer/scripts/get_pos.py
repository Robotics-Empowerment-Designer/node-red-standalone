#!/usr/bin/env python

import rospy
import intera_interface

pos1 = {'right_j0': -0.0461650390625, 'right_j1': -0.4399404296875, 'right_j2': -0.8729248046875, 'right_j3': 0.57158984375, 'right_j4': 2.9741181640625, 'right_j5': -1.6215107421875, 'right_j6': 1.568328125}
pos2 = {'right_j0': 0.0188974609375, 'right_j1': -0.2028134765625, 'right_j2': -1.3135029296875, 'right_j3': -0.0869921875, 'right_j4': 1.4694775390625, 'right_j5': -1.6114140625, 'right_j6': 1.5714267578125}


# Wenn im Container: source /opt/ros/noetic/setup.bash && source /devel/setup.bash
def get_pos():
	rospy.init_node('get_pos')
	limb = intera_interface.Limb('right')
	print("joint angles :")
	print(limb.joint_angles().values())
	print("cartesian pose")
	print(limb.endpoint_pose())
	return limb
	#exit(0)
	
if __name__ == '__main__':
	try:
		get_pos()
	except rospy.ROSInterruptException as e:
		rospy.logerr("GLOBAL") #Basic error
		exit(1)
