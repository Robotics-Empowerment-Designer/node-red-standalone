#! /usr/bin/env python

import rospy
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
from intera_interface import Limb

def move():
    parser = argparse.ArgumentParser()
    parser.add_argument("-s", "--situation", type=float, nargs='+', help="Desired end position ( X, Y, Z) and Quaternion (x, y, z, w)")
    parser.add_argument("-r", "--relative_pose", type=float, nargs='+', help="Jog pose by a relative amount in the base frame: X, Y, Z, roll, pitch, yaw")
    parser.add_argument("-T", "--in_tip_frame", action='store_true', help="For relative jogs, job in tip frame (default is base frame)")
    parser.add_argument( "-j", "--joint_angles", type=float, nargs='+', help="A list of joint angles, one for each of the 7 joints, J0...J6")
    parser.add_argument("-ls", "--linear_speed", type=float, default=0.6, help="The max linear speed of the endpoint (m/s)")
    parser.add_argument("-la", "--linear_accel", type=float, default=0.6, help="The max linear acceleration of the endpoint (m/s/s)")
    parser.add_argument("-rs", "--rotational_speed", type=float, default=1.57, help="The max rotational speed of the endpoint (rad/s)")
    parser.add_argument("-ra", "--rotational_accel", type=float, default=1.57, help="The max rotational acceleration of the endpoint (rad/s/s)")
    
    args = parser.parse_args(rospy.myargv()[1:])
    
    rospy.init_node('move')
    limb = Limb()
    
    
    if args.joint_angles:
    	#MOVE WITH ANGLES
    	if len(args.joint_angles) != 7:
    		rospy.logerr("BAD_INPUT JOINT_ANGLES")
    		exit(1)
    	
    	pos={}
    	for i in range(7):
        	s="right_j" + str(i)
        	pos[s] = args.joint_angles[i]
        	
    	limb.move_to_joint_positions(pos)
    else:
        #SETUP TRAJECTORY MODE
        traj_options = TrajectoryOptions()
        traj_options.interpolation_type = TrajectoryOptions.CARTESIAN
        traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)

        wpt_opts = MotionWaypointOptions(max_linear_speed=args.linear_speed,
                                         max_linear_accel=args.linear_accel,
                                         max_rotational_speed=args.rotational_speed,
                                         max_rotational_accel=args.rotational_accel,
                                         max_joint_speed_ratio=1.0)
        waypoint = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)

        joint_names = limb.joint_names()
        
        endpoint_state = limb.tip_state('right_hand')
        pose = endpoint_state.pose

        if args.relative_pose:
            #MOVE WITH RELATIVE
            if len(args.relative_pose) != 6:
            		rospy.logerr("BAD_INPUT RELATIVE_POSE")
            		exit(1)
    		
            trans = PyKDL.Vector(args.relative_pose[0],
                                     args.relative_pose[1],
                                     args.relative_pose[2])

            rot = PyKDL.Rotation.RPY(args.relative_pose[3],
                                         args.relative_pose[4],
                                         args.relative_pose[5])
                
            f = PyKDL.Frame(rot, trans)
            if args.in_tip_frame:
                  # tool frame
                  pose = posemath.toMsg(posemath.fromMsg(pose) * f)
            else:
                  # base frame
                  pose = posemath.toMsg(f * posemath.fromMsg(pose))
        else:
              if args.situation:
                    #MOVE WITH SITUATION
                    if len(args.situation) != 7:
                    		rospy.logerr("BAD_INPUT SITUATION")
                    		exit(1)
                    pose.position.x = args.situation[0]
                    pose.position.y = args.situation[1]
                    pose.position.z = args.situation[2]
                    pose.orientation.x = args.situation[3]
                    pose.orientation.y = args.situation[4]
                    pose.orientation.z = args.situation[5]
                    pose.orientation.w = args.situation[6]
         
        poseStamped = PoseStamped()
        poseStamped.pose = pose

        waypoint.set_cartesian_pose(poseStamped, 'right_hand', limb.joint_ordered_angles())

        traj.append_waypoint(waypoint.to_msg())

        result = traj.send_trajectory()
        if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

        if not result.result:
            rospy.logerr('TRAJECTORY_ERROR MOVE %s',result.errorId)
            return
            
        exit(0)



if __name__ == '__main__':
	try:
		move()
	except rospy.ROSInterruptException:
		rospy.logerr("GLOBAL") #Basic error code
		exit(1)
