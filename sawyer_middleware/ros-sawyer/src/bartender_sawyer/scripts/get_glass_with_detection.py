#!/usr/bin/env python

import rospy
import intera_interface
import numpy as np
import cv2
import torch
import threading
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

from cv_bridge import CvBridge, CvBridgeError

import logging
logging.basicConfig(filename='ros.log',level=logging.DEBUG)

parser = argparse.ArgumentParser()
parser.add_argument('-do','--dropOff', type=int, help='Position numbers (between 1 and 3) where the glass is to be droped off')

################ CAMERA ##################

focale_x = 1188.81628* ( 640 / 752 )
c_x = 130.234769 * ( 640 / 752 )
height_cup = 12 #cm

################ POSITIONS ###############

pos_detect_glass = {'right_j0': -0.956154296875, 'right_j1': -0.7500234375, 'right_j2': -0.0840078125, 'right_j3': 2.1074306640625, 'right_j4': 0.52949609375, 'right_j5': -2.9210869140625, 'right_j6': -1.271640625}

pos_gen = {'right_j0': -0.8131884765625, 'right_j1': -0.7814609375, 'right_j2': -0.4102216796875, 'right_j3': 2.03480078125, 'right_j4': 0.441275390625, 'right_j5': -0.8432001953125, 'right_j6': -1.2724794921875}

pos_pre_bar = [0.33629296875,-0.791025390625,-0.45423828125, 1.2202021484375, 0.1213037109375, -0.1568544921875, -1.1895634765625]

pos_bar = [0.329591796875, -0.4064501953125, -0.088365234375, 1.908662109375, 0.3708466796875, -1.2654140625, -1.3499560546875]

pos_pre_put_glass = [[0.305041015625, 0.7668427734375, -1.3863125, 0.9546611328125, 0.92139453125, -0.9726455078125, -0.5043798828125],[0.3453818359375, 0.9683125, -2.0013759765625,  0.81813671875, 1.3921142578125,-0.627083984375, -0.389177734375],[ 0.524583984375, 0.830498046875, -0.901619140625, 0.2698203125, 1.2100576171875, -0.9083359375, -1.3435654296875]]

pos_put_glass = [[ 0.2506796875,0.863505859375, -1.3675439453125, 0.7778564453125, 0.798353515625,-0.8021044921875,-0.5045869140625],[0.2697568359375, 0.911126953125,-2.0144599609375,  0.5911435546875, 0.9641943359375, -0.46542578125, -0.217849609375],[0.5198369140625, 0.842326171875, -0.901908203125, 0.2603271484375, 1.0972802734375, -0.60531640625, -1.3435654296875]]

pos_post_put_glass = [[ 0.464845703125,  0.8338876953125, -1.0946845703125, 1.028482421875, 0.739169921875, -0.9272373046875, -0.501888671875],[0.751046875, 0.8965205078125,-1.447544921875, 0.9766787109375, 0.8419921875, -0.55315625,-0.1881396484375],[1.15976171875, 0.81074609375, -0.8974140625, 0.9020009765625, 1.5620869140625, -0.693859375, -0.9985849609375]]

pos_end = [0.9390166015625, 0.5649169921875, -1.550005859375, 1.367509765625, 0.678345703125, -0.4288623046875, -0.1827451171875]

pos_neutral = [0.0018916015625, -1.178173828125, -0.00183984375, 2.17731640625, 0.0018642578125, 0.567771484375, 3.311267578125]

wpt_opts = MotionWaypointOptions(max_linear_speed=0.6,
                                         max_linear_accel=0.6,
                                         max_rotational_speed=1.57,
                                         max_rotational_accel=1.57,
                                         max_joint_speed_ratio=1,
                                         corner_distance=0.1)
                                         
wpt_accurate_opts = MotionWaypointOptions(max_linear_speed=0.6,
                                         max_linear_accel=0.6,
                                         max_rotational_speed=1.57,
                                         max_rotational_accel=1.57,
                                         max_joint_speed_ratio=0.3,
                                         corner_distance=0.05)

################ CLASS ###############

class DetectionYolov5:
	"""
	Class implements my trained model to detect cup and bottle. By Loan BERNAT.
	Github link : https://github.com/loanBRNT/sawyer_vision_bartender
	"""
	def __init__(self,model_path):
		self.model = self.load_model(model_path)
		self.classes = self.model.names
		self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
		logging.info("Using device '{0}'".format(self.device))
		
	def load_model(self,model_path):
		return torch.hub.load('ultralytics/yolov5','custom', path=model_path, trust_repo=True)
		
	def score_frame(self,frame):
		self.model.to(self.device)
		results = self.model([frame])
		labels, cord = results.xyxyn[0][:,-1], results.xyxyn[0][:,:-1]
		return labels, cord
		
	def class_to_label(self, x):
		return self.classes[int(x)]
		
	def plot_boxes(self, results, frame):
		labels, cord = results
		n = len(labels)
		x_shape, y_shape = frame.shape[1], frame.shape[0]
		for i in range(n):
			row = cord[i]
			if row[4] >= 0.7:
				x1, y1, x2, y2 = int(row[0]*x_shape), int(row[1]*y_shape), int(row[2]*x_shape), int(row[3]*y_shape)
				bgr = (0, 0, 255)
				cv2.rectangle(frame, (x1,y1), (x2,y2), bgr, 2)
				cv2.putText(frame, self.class_to_label(labels[i]), (x1,y1), cv2.FONT_HERSHEY_SIMPLEX, 0.9, bgr)
		return frame
	
	def __call__(self,frame):
		frame = cv2.resize(frame, (640,640))
		
		start = time.time()
		
		results = self.score_frame(frame)
		
		end = time.time()
		
		return results
		
		

################ FUNCTIONS ###############


detection = None
tab = []

def show_image_callback(img_data):
    """The callback function to show image by using CvBridge and cv
    """
    global detection
    global tab

    bridge = CvBridge()
    try:
        cv_image = bridge.imgmsg_to_cv2(img_data, "bgr8")
        tab.append(detection(cv_image))
    except CvBridgeError as err:
        logging.critical(err)
        return
        
def init_detection():
    global detection
    
    detection = DetectionYolov5('/model/best_small.pt')

def extract_mean_coord(tab):
    tab_mean=[]
    j = len(tab)-1
    coef=0
    while j > len(tab)/2 :
    	labels, coord = tab[j]
    	n = len(labels)
    	coord = coord.clone()
    	for i in range(n):
    	    if coef == 0:
    	    	tab_mean.append(coord[i])
    	    if n == len(tab_mean):
    	    	for k in range(5):
    	    		tab_mean[i][k]= (tab_mean[i][k] * coef + coord[i][k]) / (coef + 1)
    	j-=1
    	coef+=1
    return tab_mean
    
def coord_from_best(tab):
    if not tab:
    	return None, None, None, None, 0

    indice=0
    
    for i in range(1,len(tab)):
    	if tab[indice][4] < tab[i][4]:
    		indice=i
    
    return float(tab[indice][0]), float(tab[indice][1]), float(tab[indice][2]), float(tab[indice][3]), float(tab[indice][4])
    
def recup_glass(x1, y1, x2, y2, limb, grip):
	traj_options = TrajectoryOptions()
	traj_options.interpolation_type = TrajectoryOptions.CARTESIAN
	traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
    
	pre_point = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
	get_point = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
	got_point = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
	poseStamped = PoseStamped()
	
	endpoint_state = limb.tip_state('right_hand')
	pose = endpoint_state.pose
	
	height = (y2-y1) * 640
	pos_x = 640 * (x1+x2) / 2
		
	d = focale_x * height_cup / height
	deep = d * 0.006
	
	o = (320 - pos_x ) * d / focale_x
	if o > 0 :
		offset = o * 0.01875
	else:
		offset = o * 0.015
		
	if height < 245:
		deep = d * 0.005
	else:
		deep = d * 0.004
		
	####### CONFIGURE PRE
	rot = PyKDL.Rotation.RPY(0, 0, 0)
	trans = PyKDL.Vector(offset, 0, 0)
	
	f = PyKDL.Frame(rot, trans)
	pose = posemath.toMsg(f*posemath.fromMsg(pose))
	
	poseStamped.pose = pose
	
	joint_angles = limb.joint_ordered_angles()
	pre_point.set_cartesian_pose(poseStamped, 'right_hand', joint_angles)
	
	traj.append_waypoint(pre_point.to_msg())
	
	####### CONFIGURE GET
	rot = PyKDL.Rotation.RPY(0, 0, 0)
	trans = PyKDL.Vector(0, -deep, 0)
	
	
	f = PyKDL.Frame(rot, trans)
	pose = posemath.toMsg(f*posemath.fromMsg(pose))
	
	poseStamped.pose = pose
	
	joint_angles = limb.joint_ordered_angles()
	get_point.set_cartesian_pose(poseStamped, 'right_hand', joint_angles)
	
	
	traj.append_waypoint(get_point.to_msg())
	
	result = traj.send_trajectory()
	if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

	if not result.result:
            rospy.logerr('TRAJECTORY_ERROR MOVE %s', result.errorId)
            return
        
	grip.set_position(0.025)
	
	traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
	####### CONFIGURE GOT
	rot = PyKDL.Rotation.RPY(0, 0, 0)
	trans = PyKDL.Vector(0, 0, 0.2)
	
	f = PyKDL.Frame(rot, trans)
	pose = posemath.toMsg(f*posemath.fromMsg(pose))
	
	poseStamped.pose = pose
	
	joint_angles = limb.joint_ordered_angles()
	got_point.set_cartesian_pose(poseStamped, 'right_hand', joint_angles)
	
	
	traj.append_waypoint(got_point.to_msg())
	
	result = traj.send_trajectory()
	if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

	if not result.result:
            rospy.logerr('TRAJECTORY_ERROR MOVE %s', result.errorId)
            return


def deposit_glass(n,limb,grip):
    traj_options = TrajectoryOptions()
    traj_options.interpolation_type = TrajectoryOptions.CARTESIAN
    traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
    
    joint_names = limb.joint_names()
      
    waypoint = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
    poseStamped = PoseStamped()  
    
    #PRE BAR WAYPOINT
    waypoint.set_joint_angles(pos_pre_bar, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    #BAR WAYPOINT
    waypoint.set_joint_angles(pos_bar, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    #DEPOSIT WAYPOINTS
    waypoint.set_joint_angles(pos_pre_put_glass[n], 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    waypoint.set_joint_angles(pos_put_glass[n], 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    result = traj.send_trajectory()
    if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

    if not result.result:
            rospy.logerr('TRAJECTORY_ERROR MOVE %s', result.errorId)
            return
    grip.open()
    
    traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
    
    waypoint.set_joint_angles(pos_post_put_glass[n], 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    #END WAYPOINTS
    waypoint.set_joint_angles(pos_end, 'right_hand', joint_names)
    traj.append_waypoint(waypoint.to_msg())
    
    result = traj.send_trajectory()
    if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

    if not result.result:
            rospy.logerr('TRAJECTORY_ERROR MOVE %s', result.errorId)
            return

    
    

def glass_detection():
    args = parser.parse_args()
    if not args.dropOff or args.dropOff < 1 or args.dropOff > 3:
    	exit(1)
    init_thread = threading.Thread(target=init_detection)
    init_thread.start()

    rp = intera_interface.RobotParams()

    rospy.init_node('glass_detection')
    
    grip = intera_interface.Gripper()
    grip.open()
    
    l = intera_interface.Limb('right')
    li = intera_interface.Lights()
    li.set_light_state("head_red_light",True)
    
    cam = 'right_hand_camera'

    l.set_joint_position_speed(0.3)	
    l.move_to_joint_positions(pos_detect_glass)
    
    cameras = intera_interface.Cameras()
    cameras.start_streaming(cam)
    cameras.set_exposure(cam, 5)
    
    init_thread.join()
    
    li.set_light_state("head_red_light",False)
    li.set_light_state("head_green_light",True)
    
    global detection
    
    cameras.set_callback(cam, show_image_callback,
        rectify_image=True)
    
    global tab
    
    time.sleep(2)
    
    cameras.stop_streaming(cam)
    l.move_to_joint_positions(pos_gen)    
    
    x1, y1, x2, y2, conf = coord_from_best(extract_mean_coord(tab))
    
    li.set_light_state("head_green_light",False)
    
    if conf < 0.5:
    	l.move_to_neutral()
    	rospy.logerr('NO_OBJECT_DETECTED cup')
    else:
    	recup_glass(x1, y1, x2, y2, l, grip)
    	deposit_glass(args.dropOff-1,l, grip)
    
    exit(0)
    
if __name__ == '__main__':
	try:
		glass_detection()
	except rospy.ROSInterruptException as e:
		logging.critical(e)
		pass
