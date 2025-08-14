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

#import pandas, tqdm, ultralytics
from cv_bridge import CvBridge, CvBridgeError

################ POSITION ###############

parking_pose = {'position': [0.450445140130699, 0.16049881120048198, 0.2141410747437623], 'orientation': [0.7047397651848174, 0.7094590289687702, 0.0001670304255709002, 0.0031179613173078257]}

parking_angles = [0.0018916015625, -1.178173828125, 0.0016513671875, 2.1770283203125, -0.0010400390625, 0.5632392578125, 3.3139521484375]

pos_detect_bottle = {'right_j0': 1.2870205078125, 'right_j1': 0.029998046875, 'right_j2': 0.0209970703125, 'right_j3': 1.4006435546875, 'right_j4': -0.2148701171875, 'right_j5': -2.978966796875, 'right_j6': 0.087791015625}

pos_gen = {'right_j0': 1.2172041015625, 'right_j1': -0.0459296875, 'right_j2': 0.004701171875, 'right_j3': 1.3542724609375, 'right_j4': -0.2974365234375, 'right_j5': -1.3793916015625, 'right_j6': -1.346857421875}

parser = argparse.ArgumentParser()
parser.add_argument('-d','--drink', type=str, help='Drink to pour')
parser.add_argument('-do','--dropOff', type=int, help='Position numbers (between 1 and 3) where the glass is')

wpt_opts = MotionWaypointOptions(max_linear_speed=0.6,
                                         max_linear_accel=0.6,
                                         max_rotational_speed=1.57,
                                         max_rotational_accel=1.57,
                                         max_joint_speed_ratio=1.0,
                                         corner_distance=0.1)

pos_interm = [0.9757421875, -0.199314453125, -0.547630859375, 1.1335419921875,  2.9047998046875, 0.96819140625, 2.3736865234375]

pos_go_to_glass = [0.64188671875, -0.369873046875,  -0.3039892578125,  1.710625,  2.9776171875,  1.3243916015625, 1.912365234375]

pos_pre_pour = [[0.1922861328125, 0.035548828125, -0.30747265625, 1.12749609375, 2.97741015625,  1.11075390625, 2.034103515625],[0.16102734375, 0.0102783203125, 0.4033466796875, 1.3783203125, 2.3444384765625, 0.9012734375, 2.659044921875],[0.8948623046875, 0.236021484375, -0.26154296875, 0.9559609375, 2.9749443359375, 1.057625, 1.96664453125]]

pos_pour = [[-0.033791015625, -0.0165419921875, 0.156546875, 1.2946455078125, 2.771919921875, 0.89508984375, 1.3623994140625],[0.156486328125, -0.040796875, 0.33340625, 1.421677734375,  2.2584384765625, 0.9436083984375, 3.4513115234375],[0.843587890625, 0.4864814453125, -0.4678994140625, 0.732396484375, 2.9770107421875, 1.0247802734375, 2.6678759765625]]

pos_pouring= [[0.1152265625, 0.074287109375, -0.04066796875, 1.0553896484375, 2.90252734375, 0.586517578125, 0.0468515625],[0.156486328125, -0.040796875, 0.33340625, 1.421677734375,  2.2584384765625, 0.9436083984375, 3.4513115234375],[0.84534375, 0.444861328125, -0.3554404296875, 0.7752666015625, 2.9757705078125, 1.02932421875, 3.857361328125]]

################ CAMERA ##################

focale_x = 1188.81628* ( 640 / 752 )
c_x = 130.234769 * ( 640 / 752 )
heights = {'Coca':23,'Orange':24,'Water':22} #cm

################ CLASS ###############

class DetectionYolov5:
	"""
	Class implements my trained model to detect cup and bottle. By Loan BERNAT.
	Github link : https://github.com/loanBRNT/sawyer_vision_bartender
	"""
	def __init__(self,model_path):
		self.model = self.load_model(model_path)
		print(f"Model: {self.model}")
		self.classes = self.model.names
		self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
		rospy.loginfo("Using device '{0}'".format(self.device))
		
	def load_model(self,model_path):
		return torch.hub.load('ultralytics/yolov5','custom', path=model_path)
		
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
        rospy.logerr(err)
        return
        
def init_detection():
    global detection
    
    detection = DetectionYolov5('/model/best_small_complet.pt')

def extract_mean_coord(tab):
    tab_mean=[]
    tab_labels=[]
    j = len(tab)-1
    coef=0
    while j > len(tab)/2 :
    	labels, coord = tab[j]
    	n = len(labels)
    	coord = coord.clone()
    	for i in range(n):
    	    if coef == 0:
    	    	tab_mean.append(coord[i])
    	    	tab_labels.append(labels[i])
    	    if n == len(tab_mean):
    	    	if tab_labels[i] == labels[i]:
	    	    	for k in range(5):
	    	    		tab_mean[i][k]= (tab_mean[i][k] * coef + coord[i][k]) / (coef + 1)
    	j-=1
    	coef+=1
    return tab_mean, tab_labels
    
def coord_from_best(tab_mean,tab_labels,boisson):

    global detection
    
    if not tab_mean:
    	return None, None, None, None, 0

    indice=-1
    
    for i in range(len(tab_mean)):
    	if detection.class_to_label(tab_labels[i]) == boisson:
    		if indice == -1:
    			indice=i
	    	elif tab_mean[indice][4] < tab_mean[i][4]:
	    		indice=i
    
    if indice==-1:
    	return None, None, None, None, 0
    
    return float(tab_mean[indice][0]), float(tab_mean[indice][1]), float(tab_mean[indice][2]), float(tab_mean[indice][3]), float(tab_mean[indice][4])


def recup_bottle(x1, y1, x2, y2, limb, h, grip):
	traj_options = TrajectoryOptions()
	traj_options.interpolation_type = TrajectoryOptions.CARTESIAN
	traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
    
	waypoint = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
	poseStamped = PoseStamped()
	
	endpoint_state = limb.tip_state('right_hand')
	pose = endpoint_state.pose
	
	height = (y2-y1) * 640
	pos_x = 640 * (x1+x2) / 2
		
	d = (focale_x * h / height)  
	deep = (d - 30) / 100
	
	o = (pos_x-320 ) * d / focale_x
	offset = o * 0.017
	
	####### CONFIGURE PRE
	rot = PyKDL.Rotation.RPY(0, 0, 0)
	trans = PyKDL.Vector(offset, 0, 0)
	
	f = PyKDL.Frame(rot, trans)
	pose = posemath.toMsg(f*posemath.fromMsg(pose))
	
	poseStamped.pose = pose
	
	joint_angles = limb.joint_ordered_angles()
	waypoint.set_cartesian_pose(poseStamped, 'right_hand', joint_angles)
	
	traj.append_waypoint(waypoint.to_msg())
	
	####### CONFIGURE GET
	rot = PyKDL.Rotation.RPY(0, 0, 0)
	trans = PyKDL.Vector(0, deep, 0)
	
	f = PyKDL.Frame(rot, trans)
	pose = posemath.toMsg(f*posemath.fromMsg(pose))
	
	poseStamped.pose = pose
	
	joint_angles = limb.joint_ordered_angles()
	waypoint.set_cartesian_pose(poseStamped, 'right_hand', joint_angles)
	
	traj.append_waypoint(waypoint.to_msg())
	
	result = traj.send_trajectory()
	if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

	if not result.result:
            rospy.logerr('TRAJECTORY_ERROR PRE_BOTTLE %s', result.errorId)
            return
	grip.close()

def pouring(limb,grip,n):
	traj_options = TrajectoryOptions()
	traj_options.interpolation_type = TrajectoryOptions.CARTESIAN
	traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
    
	waypoint = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
	sauv_waypoint = MotionWaypoint(options = wpt_opts.to_msg(), limb = limb)
	poseStamped = PoseStamped()
	
	joint_names = limb.joint_names()
	
	endpoint_state = limb.tip_state('right_hand')
	pose = endpoint_state.pose
	pose_sauv = pose
	
	rot = PyKDL.Rotation.RPY(0,0,0)
	trans = PyKDL.Vector(0,0,0.3)
	
	f2 = PyKDL.Frame(rot, trans)

	pose = posemath.toMsg(f2 * posemath.fromMsg(pose))

	poseStamped.pose = pose
	joint_angles = limb.joint_ordered_angles()

	sauv_waypoint.set_cartesian_pose(poseStamped, 'right_hand', joint_angles)
	traj.append_waypoint(sauv_waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_interm, 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_go_to_glass, 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_pre_pour[n-1], 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_pour[n-1], 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_pouring[n-1], 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())

	result = traj.send_trajectory()
	if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

	if not result.result:
            rospy.logerr('TRAJECTORY_ERROR GO_TO_GLASS %s', result.errorId)
            return
	#'''
	time.sleep(1)
	
	traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
	
	waypoint.set_joint_angles(pos_pour[n-1], 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_pre_pour[n-1], 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_go_to_glass, 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	waypoint.set_joint_angles(pos_interm, 'right_hand', joint_names)
	traj.append_waypoint(waypoint.to_msg())
	
	traj.append_waypoint(sauv_waypoint.to_msg())
	
	poseStamped_sauv = PoseStamped()
	poseStamped_sauv.pose = pose_sauv
	waypoint.set_cartesian_pose(poseStamped_sauv, 'right_hand', joint_angles)
	traj.append_waypoint(waypoint.to_msg())
	
	result = traj.send_trajectory()
	if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

	if not result.result:
            rospy.logerr('TRAJECTORY_ERROR DEPOSIT_BOTTLE %s', result.errorId)
            return
	grip.open()
	
	traj = MotionTrajectory(trajectory_options = traj_options, limb = limb)
	
	traj.append_waypoint(sauv_waypoint.to_msg())

	pose.position.x = parking_pose['position'][0]
	pose.position.y = parking_pose['position'][1]
	pose.position.z = parking_pose['position'][2]
	pose.orientation.x = parking_pose['orientation'][0]
	pose.orientation.y = parking_pose['orientation'][1]
	pose.orientation.z = parking_pose['orientation'][2]
	pose.orientation.w = parking_pose['orientation'][3]
	
	poseStamped.pose = pose
	waypoint.set_cartesian_pose(poseStamped, 'right_hand', parking_angles)
	traj.append_waypoint(waypoint.to_msg())
	
	result = traj.send_trajectory()
	if result is None:
            rospy.logerr('TRAJECTORY_NOT_SEND')
            return

	if not result.result:
            rospy.logerr('TRAJECTORY_ERROR RESET %s', result.errorId)
            return

def pour_glass():
    args = parser.parse_args()
    if not args.dropOff or args.dropOff < 1 or args.dropOff > 3:
    	exit(1)
    if not args.drink in heights:
    	exit(2)
    init_thread = threading.Thread(target=init_detection)
    init_thread.start()
    
    rospy.init_node('pour_with_detection')

    rp = intera_interface.RobotParams()
    grip = intera_interface.Gripper()
    grip.open()
    
    l = intera_interface.Limb('right')
    li = intera_interface.Lights()
    li.set_light_state("head_red_light",True)
    
    cam = 'right_hand_camera'

    l.set_joint_position_speed(0.3)	
    l.move_to_joint_positions(pos_detect_bottle)
    
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
    
    time.sleep(3)
    
    cameras.stop_streaming(cam)
    
    l.move_to_joint_positions(pos_gen)
    
    t_m, t_l = extract_mean_coord(tab)
    
    x1, y1, x2, y2, conf = coord_from_best(t_m,t_l,args.drink)
    
    print(str(x1) +","+ str(y1)+","+str(x2)+","+str(y2)+","+str(conf))
    
    li.set_light_state("head_green_light",False)
    

    if conf < 0.5:
    	l.move_to_neutral()
    	rospy.logerr('NO_OBJECT_DETECTED ' + args.drink)
    else:
    	recup_bottle(x1, y1, x2, y2, l, heights[args.drink],grip)
    	pouring(l,grip,args.dropOff)

	

if __name__ == '__main__':
	try:
		pour_glass()
	except rospy.ROSInterruptException:
		pass
