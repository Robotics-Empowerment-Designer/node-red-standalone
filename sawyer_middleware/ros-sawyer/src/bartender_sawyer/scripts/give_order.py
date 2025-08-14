#!/usr/bin/env python

import rospy
import intera_interface
import time
import argparse

from intera_motion_interface import (
    MotionTrajectory,
    MotionWaypoint,
    MotionWaypointOptions
)

from intera_motion_msgs.msg import TrajectoryOptions
from geometry_msgs.msg import PoseStamped
import PyKDL
from tf_conversions import posemath

import logging
logging.basicConfig(filename='ros.log',level=logging.DEBUG)

parser = argparse.ArgumentParser()
parser.add_argument('-pu','--pickUp', type=int, help='Position numbers (between 1 and 3) where the glass is on the bar')

################ POSITIONS ###############

pos_bar = {'right_j0': 0.329591796875, 'right_j1': -0.4064501953125, 'right_j2': -0.088365234375, 'right_j3': 1.908662109375, 'right_j4': 0.3708466796875, 'right_j5': -1.2654140625, 'right_j6': -1.3499560546875}

pos_pre_tray = [-0.4987705078125, 0.5428173828125, -1.6257216796875, 0.787484375, 0.4435478515625, -1.354693359375, -0.235912109375]

pos_tray = [-0.8507626953125, 0.78133984375, -1.886859375, 0.2364423828125, 0.73111328125, -1.21626171875, -0.6133115234375]

pos_post_tray_1 = [-0.843140625, 0.7406201171875, -1.896361328125, 0.2719765625, 0.4234580078125, -1.1607451171875, -0.4078603515625]

pos_post_tray_2 = [-0.68046875, 0.872453125, -1.8946376953125, 0.797265625, 0.7426943359375, -1.5317275390625, -0.2679052734375]

pos_end = [-0.2042265625, 0.8425322265625, -2.086484375, 1.8159013671875, 0.7536552734375, -1.668080078125, 0.6110205078125]

pos_post_put_glass = [[ 0.464845703125,  0.8338876953125, -1.0946845703125, 1.028482421875, 0.739169921875, -0.9272373046875, -0.501888671875],[0.751046875, 0.8965205078125,-1.447544921875, 0.9766787109375, 0.8419921875, -0.55315625,-0.1881396484375],[1.15976171875, 0.81074609375, -0.8974140625, 0.9020009765625, 1.5620869140625, -0.693859375, -0.9985849609375]]

pos_put_glass = [[ 0.1779423828125, 0.8379013671875, -1.342115234375, 0.6649287109375, 0.782833984375, -0.7749912109375, -0.604390625],[0.2203408203125, 0.8696806640625, -1.8805341796875, 0.4750849609375, 0.991888671875, -0.4857734375, -0.4321455078125],[0.3962373046875, 0.9116416015625, -1.1295693359375, 0.1124423828125, 1.275296875, -0.587240234375, -1.401615234375]]

pos_pre_put_glass = [[0.4235791015625, 0.52687890625, -1.3620576171875, 1.1988984375, 0.626185546875,-0.9498447265625, -0.2942822265625],[0.633525390625, 0.4607861328125, -1.6633408203125,  1.09943359375, 0.4715126953125, -0.5823212890625, 0.0852998046875],[0.3963408203125, 0.411654296875, -1.1323125, 0.294986328125, 1.140248046875, -0.4699443359375, -1.2257548828125]]

wpt_opts = MotionWaypointOptions(max_linear_speed=0.6,
                                         max_linear_accel=0.6,
                                         max_rotational_speed=1.57,
                                         max_rotational_accel=1.57,
                                         max_joint_speed_ratio=1.0,
                                         corner_distance=0.1)

def give_order():
    args = parser.parse_args()
    if not args.pickUp or args.pickUp < 1 or args.pickUp > 3:
    	exit(1)

    rospy.init_node('glass_detection')
    
    limb = intera_interface.Limb('right')

    limb.set_joint_position_speed(0.3)	
    limb.move_to_joint_positions(pos_bar)
    
    traj_options = TrajectoryOptions()
    traj_options.interpolation_type = TrajectoryOptions.CARTESIAN
    traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
    
    joint_names = limb.joint_names()
      
    waypoint = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
    poseStamped = PoseStamped()
    
    #WAYPOINTS  
    waypoint.set_joint_angles(pos_post_put_glass[args.pickUp-1], 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    waypoint.set_joint_angles(pos_put_glass[args.pickUp-1], 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    #'''
    waypoint.set_joint_angles(pos_pre_put_glass[args.pickUp-1], 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    

    waypoint.set_joint_angles(pos_pre_tray, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    waypoint.set_joint_angles(pos_tray, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    waypoint.set_joint_angles(pos_post_tray_1, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    waypoint.set_joint_angles(pos_post_tray_2, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    waypoint.set_joint_angles(pos_end, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    #'''
    
    result = traj.send_trajectory()
    if result is None:
            logging.error('TRAJECTORY_NOT_SEND')
            return

    if not result.result:
            logging.critical('TRAJECTORY_ERROR GIVE_ORDER %s', result.errorId)
      
    exit(0)
    
if __name__ == '__main__':
	try:
		give_order()
	except rospy.ROSInterruptException as e:
		logging.critical(e)
		pass
