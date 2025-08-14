# # This is an auto generated Dockerfile for ros:ros-base
# # generated from docker_images/create_ros_image.Dockerfile.em
FROM ros:noetic-ros-core-focal

# install ros packages
RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing\
    ros-noetic-ros-base=1.5.0-1* \
    git-core \
    neovim \
    python3 \
    python3-pip \
    netcat-openbsd \
    python-is-python3\
    build-essential \
    python3-rosdep \
    python3-rosinstall \
    python3-vcstools \
    python3-wstool \
    python3-vcstools \
    python3-rosdep \
    ros-noetic-control-msgs \
    ros-noetic-xacro \
    ros-noetic-tf2-ros \
    ros-noetic-rviz \
    ros-noetic-cv-bridge \
    ros-noetic-actionlib \
    ros-noetic-actionlib-msgs \
    ros-noetic-dynamic-reconfigure \
    ros-noetic-trajectory-msgs \
    ros-noetic-rospy-message-converter \
    ros-noetic-tf-conversions &&\
    apt-get clean &&\
    rm -rf /var/lib/apt/lists/*
#neovim entfernen!!!

# bootstrap rosdep
RUN rosdep init && \
    rosdep update --rosdistro $ROS_DISTRO

RUN pip3 install --upgrade pip && pip3 install --no-deps --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-deps --no-cache-dir typing_extensions pandas==2.0.3 psutil==6.1.0 tqdm==4.67.1 ultralytics==8.3.51 gitpython==3.1.43 #torch==2.4.1 torchvision==0.19.1

EXPOSE 8000

COPY ./listen.py /listen.py
COPY ./entrypoint.sh /entrypoint.sh
COPY ./model /model
COPY ./src /src

ENV PYTHONPATH "${PYTHONPATH}:/src/initialisation.py"

RUN /bin/bash -c "source /opt/ros/noetic/setup.bash; catkin_make"

