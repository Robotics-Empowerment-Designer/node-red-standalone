#!/usr/bin/env bash

# Each Statement runs their own buildContainers.sh and logs it. If the file is not found you get an error message

# Run Node-Red^2 build process
if [[ -f "./buildContainers.sh" ]]; then
    echo "Started process to build Node-Red^2...  Please be patient..."
    bash buildContainers.sh >"nodered_square.log" 2>&1 &
else
    echo "WARNING: buildContainers.sh for Node-Red^2 could not be found!"
fi

# Run Pepper-Container build process
if [[ -f "./pepper-middleware/buildContainers.sh" ]]; then
    echo "Started process to build Pepper-Container... Please be patient..."
    (cd ./pepper-middleware && bash buildContainers.sh >"../pepper.log" 2>&1 &)
else
    echo "WARNING: buildContainers.sh for Pepper could not be found!"
fi

# Run Sawyer-Container build process
if [[ -f "./sawyer_middleware/buildContainers.sh" ]]; then
    echo "Started process to build Sawyer-Container... Please be patient..."
    (cd ./sawyer_middleware && bash buildContainers.sh >"../sawyer.log" 2>&1)
else
    echo "WARNING: buildContainers.sh for Sawyer could not be found!"
fi

#waits for the processes to finish
wait

echo "Build processes are done. Please check the log files for errors before starting with 'compose up'."

echo "Press any key to continue setting up the environment-values..."
read -r -n 1 -s
bash make_env.sh
