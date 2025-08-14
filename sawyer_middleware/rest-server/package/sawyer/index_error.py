trajectory_error = {'CARTESIAN_INTERPOLATION_FAILED':"A valid Cartesian trajectory could not be generate", 'FAILED_TO_PARAMETERIZE':"A valid joint trajectory spline could not be generated", 'PLANNED_MOTION_COLLISION':"A self-collision was found",'ENDPOINT_DOES_NOT_EXIST':"The endpoint string was not found in the current URDF",'PLANNED_JOINT_ACCEL_LIMIT':"Violation of joint limits. Try reducing ratio speed",'CONTROLLER_NOT_FOLLOWING':"Trajectory Stopped cause of a collision",'ZERO_G_ACTIVATED_DURING_TRAJECTORY':"Trajectory Stopped because zero-g was activated mid-motion",'FINAL_POSE_NOT_WITHIN_TOLERANCE':"Joints did not settle within the desired joint tolerance"}

def handle_error(response,allow_try_again=False,detailled_info=False):
	status=""
	infos=""
	try_again=False
	if response != "":
		errors = response.split("\n")
		for error in errors:
			tab_error = error.split(" ")
			if len(tab_error) < 3:
				continue
			if tab_error[2] == "BAD_INPUT":
				status = status + "BAD INPUT " + tab_error[3] + ". Verify your settings.\n"
			elif tab_error[2] == "TRAJECTORY_ERROR":
				status = status + "TRAJECTORY ERROR during " + tab_error[3] + " movement"
				if detailled_info:
					infos=tab_error[3]
				if tab_error[4] in trajectory_error:
					status = status + ". " + trajectory_error[tab_error[4]]
					try_again=True
				status = status + ".\n"
			elif tab_error[2] == "ROBOT_NOT_ENABLE":
				status = status + "CANT ENABLE THE ROBOT. Verify the emergency button.\n"
			elif tab_error[2] == "GRIPPER_NOT_READY":
				status = status + "GRIPPER NOT READY. Verify that the gripper is empty and correctly assembled.\n"
			elif tab_error[2] == "NO_OBJECT_DETECTED":
				status = status + "Cant detect " + tab_error[3] + ". Verify the environment."
	if detailled_info:
		return status, (allow_try_again and try_again), infos
	return status, (allow_try_again and try_again)
