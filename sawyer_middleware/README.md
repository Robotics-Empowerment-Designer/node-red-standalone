# sawyer-node-red

![Logo](imgReadme/logo.png)

# Bartender sawyer with Node-red
By [Loan BERNAT](https://loanbrnt.github.io/) for my M1 internship. 
Contact : loan.brnt@gmail.com or +33651229452

## 1 - Description
A bartender application for sawyer robot using Node-Red, Docker, Flask and Yolov5. The application has two modes of use : Classic and Advanced.

- With Classic, it uses fixed position marked with scotch.

- With Advanced, it uses object detection with a personal Yolov5 datasets. You can find a complete version of it (scripts and dataset without labels) on [my github page](https://github.com/loanBRNT/sawyer_vision_bartender) or only the dataset labelled on the [robotflow website](https://universe.roboflow.com/bernat-loan/bartender-sawyer-vision/dataset/3). I integrated in the application only usefull scripts and models from it. 

You can mix advanced and classic nodes to adapt the application to your constraints.

---

**Versions:**
- Fixed position V1.0 : [Youtube Video](https://youtu.be/lT4WaLM3AWw)
- Fixed position V1.5 : [Youtube Video](https://youtu.be/8MbCvps2-aU)
- Object Detection V2.0 : [Youtube Video](https://youtu.be/Euf1ZaoABLU)

---

In both case, the application is built around the Bar class which gives at the robot a "memory" for orders and a sense of priority : It stops preparing the order it is currently working on if a waiter asks for picking up another one, to give the requested order to the waiter as quickly as possible and limit the waiter's loss of time. This is how the Bar class is structured :

![Alt text](imgReadme/BarClass.png)

Sawyer communicates with waiters using TCP nodes from Node-Red. See the diagram belows : ![Alt text](imgReadme/Communication.png)

**IMPORTANT** : The IPs shown in the diagram aren't the IP of the robots. It's the IP of the Host machine on which flows are running. You can run everything on your computer, so the IP to use into all TCP will be your localhost. Or you can work in a team, and replace localhost by the IP address of your teammate. If you don't know your IP you can use `hostname -i` or look into the setting of your virtual machine.


For a complete description of each nodes used, please open the documentation directly included in the node-red project (run project -> open node-red interface -> documentation widget)


## 2 - Installation and Configuration

The project was developed on Ubuntu 20.04. You can use a virtual Machine but make sure that the bridge mode is enabled.


The first step is to clone this repository. Then, you will need to change some parameters in the
 `.env` file. 

- ROS_IP = your host ip adress (hostname -i or in network settings)
- ROBOT_IP_SAWYER = Verify that the ip is correct

After this, make sure to already have Docker installed. Otherwise, check instructions at this link to install [install docker on ubuntu](https://docs.docker.com/engine/install/ubuntu/) and then do the linux post-installation [here](https://docs.docker.com/engine/install/linux-postinstall/) to allow you to use docker without sudo.

Then you can build the project with `sudo ./buildContainers.sh`. It's going to take a while, so you can start preparing the robot's environment.<br><br>

**Bottles area** : The table should be positioned like in the 2nd picture. The three grey tapes on the first picture mark the position of each type of bottle ("C" for Coca, "W" for Water, "O" for Orange). The red/white tape delimits an area representing the camera's field of view in object detection mode. If you are using this mode, bottles need to be inside of this area to be detected.


<div style="display:flex;">
    <img src="imgReadme/IMG_2168.png" width=50% height=50%>
    <img src="imgReadme/IMG_2169.png" width=50% height=50%>
</div>
<br>

**Preparation area** : Position the first low table as shown in the first picture. The stool on the 2nd simulates the location of a robot picking up an order. The back legs should be placed on the tape marks and the height of the tray should be approximately 65 cm from the floor.

<div style="display:flex;">
    <img src="imgReadme/IMG_2170.png" width=50% height=50%>
    <img src="imgReadme/IMG_2171.png" width=50% height=50%>
</div><br>

**Glass area** : The second low table should be positioned as shown in the first picture and the tool on it should have 2 its two legs on the border as shown in the second picture

<div style="display:flex;">
    <img src="imgReadme/IMG_2172.png" width=50% height=50%>
    <img src="imgReadme/IMG_2174.png" width=50% height=50%>
</div><br>

## 3 - Usage

Turn on the sawyer and make sure that it is in SDK mode (Black screen with SDK written on it). If not, turn it off. Then, turn it on again and press CTRL + F on the keyboard until a setting menu appears. Here, select 'boot in SDK' and reboot again.


After following the Installation instructions. You can build the project (if it's isn't already done) with
 `./buildContainers`. Then, you can launch the project with `docker-compose up`. 

If you have some errors, contact your professor. If everything is ok, you can open the Node-Red Interface by clicking on the link in your console : [localhost](https://localhost:1880). And you should have a flow that looks like this : ![Alt text](imgReadme/Bartender%20Application.png)

#### Some importants things :
- Always verify that the robot environment is safe and the emergency button is accessible.
- Use the *initialisation* node as a reset and start protocol. That allow the robot to go back to its "parking position" before running any programs and calibrate its gripper.
- Never use directly opened bottles. Water can damage the robot. Always, make some tests with closed bottles before.

**And now, you are ready to create your own application using Sawyer specific nodes!** *Enjoy*

## 4 - How to Create your own Nodes

### 4.1 - How the project work

First of all, you need to understand how work the application. If you are not familiar with [Docker](https://docs.docker.com/get-started/overview/), [Flask](https://pythonbasics.org/what-is-flask-python/), [ROS](http://wiki.ros.org/ROS/Introduction) and [Node-red](https://nodered.org/), I'd advise you to find out a bit more about them first.

So, the project is divided in 3 containers : 
- **node-red** with all node-red stuffs (Front end), 
- **ros-sawyer** in which you will find my ROS package bartender-sawyer and the original ROS package of sawyer intera_interface. This container allows me to run scripts on sawyer with command system (Back end).
- **rest-server** which do the link between Node-Red and ROS. It receives message from Node-red container with socket.io, handles the message and sends the right command to the ROS container.

![Alt text](imgReadme/Node-Red%20Container.png)

The communication between all these containers is simple because they all share the same IP address as your computer. That's why the bridge mode is important!


Parameters, dependencies and environment variables are defined in DockerFile of each container and in the docker-compose.yml


To resume, this is an example of what's going on when you use the light node :


![Alt text](imgReadme/lights.js.png)

Now that you understand the overall structure of the project a little better, it's time to code!

### 4.2 - Create the ROS script

The first thing to do is to create your ROS script. The better way to do that is to have an external folder. But for this, you need to have ROS-noetic installed and some other parameters configured. I won't go into details here, I recommend that you follow the steps on the official [Rethink Robotics website](https://support.rethinkrobotics.com/support/solutions/articles/80000980134-workstation-setup), taking care to use the commands for Ubuntu 20.04 and Ros:Noetic.

You can find the python SAWYER API [here](https://rethinkrobotics.github.io/intera_sdk_docs/5.1.0/intera_interface/html/index.html).

If your script needs params, use `argparse`. 

When you finished to code and test the script outside the project, copy your script into `ros-sawyer/src/bartender_sawyer/scripts/` and add your script to the `ros-sawyer/src/bartender_sawyer/CMakeList.txt`.

If you need particular librairy, you need to modify the dockerfile to install them into the container.

### 4.3 - Create the rest-server package

For this part, you will need to create a new python file or just add a function into an existent one (if your node is linked to an existing one) inside this folder `rest-server/package/sawyer/endpoints/`.

In your function, you will need to handle different things :
- Choose the "topic" message which will activate the function when the rest-server receives a message on it. The convention that I choose to follow is '/sawyer/nom_event'.
- The communication with the ros container. So what command do you need to run your script? With paramameters?
- What parameters do you need to receive from the node-red containers.

When you have finished, if needeed, add your file to `rest-server/app.py`.

### 4.4 - Design the node

To create a node, you need **4** files into `node-red/nodes/`:

- my_own_node/my_own_node.js : The main file of your node. Inside, you will define whats do you want to send to your package in the rest_server.
- my_own_node/my_own_node.html : In this one, you define what your node will look like, as well as its parameters.
- my_own_node/locales/EN-US/my_own_node.json : JSON file
- my_own_node/locales/EN-US/my_own_node.html : Documentation file

I recommend you to take inspiration from one of my existing node to understand the structure of each file. You can also take a look at this link : [Creating Node](https://nodered.org/docs/creating-nodes/).

After creating and writing all these files. Dont forget to add your node to the package.json!

Now, just re-build the project and...
**Congrats! You have created your first Node**

## 6 - Acknowledgment
This project was inspired by the work of Kai Ruske and Michel Weike.

## 7 - Project status
Ended

## 8 - Improvements

**SECURITY** :  I think security and communication are the two most important points to improve in further works. Currently there is a little bug : when you stop the app and relaunch it directly, the ros-container add an error (listen.py don't succeed to connect to the right communication port)


**SAFETY** : Add some verifications after the Get Glass or before the Pour to be sure that there is a glass on the bar and not pour on the table.


**ROBOT ENVIRONMENT** : It is very simple for now, but it would be interesting to have something really more like a bar (shelves, drinks case…) and adapt scripts in consequence.

**NEW FEATURES** : Implements some new features like the capacity to make cocktails or even to open bottles by itself. For cocktails, you can maybe find a way to estimate the weight of the bottle from the force of each joint to take the bottle.

**ERROR MANAGEMENT** : Currently, if a critical error occurs during a preparation (no cups/bottles detected, not able to follow the trajectory...), the robot stops its flow and needs an action from the supervisor (rebooting or reset). It can be interesting to add a system that allows the robot to restart itself without a full reset.

**CLASSIC FEATURES** : Create some low-level nodes to command the Head rotation, the cuff, camera. Improve movement nodes by doing something more permissive.
