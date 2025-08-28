#!/usr/bin/env bash

# Script to setup .env-file

# Function to get hosts ip address
get_host_ip() {
  ip route get 1 | awk '{print $7}'
}

# Declaring standart-values
declare -A std_env_vars=(
  ["OPENAI_API_KEY"]=""
  ["NODE_RED_PORT"]="1880"
  ["HOSTNAME"]="node-red"
  ["NODE_RED_LOG_LEVEL"]="warn"
  ["PEPPER_REST_SERVER_IP"]="pepper-rest-server"
  ["PEPPER_REST_SERVER_PORT"]="5001"
  ["ROBOT_IP_PEPPER"]="salt.hcr-lab"
  ["NODE_RED_PORT_PEPPER"]="1881"
  ["QI_LOG_LEVEL"]="4" # [0, 6] (6=verbose)
  ["MQTT_PORT_PEPPER"]="1884"
  ["ROBOT_NAME_PEPPER"]="Pepper"
  ["NODE_ENV"]="prod" # or dev
  ["REST_LOG_LEVEL"]="DEBUG"
  ["FLASK_IP_PEPPER"]=""
  ["FLASK_PORT_PEPPER"]="5001"
  ["TEMI_PORT"]="1885"
  ["TEMI_ADDRESS"]=""
  ["ROBOT_NAME"]="Sawyer"
  ["ROBOT_IP_SAWYER"]="sawyer.hcr-lab"
  ["FLASK_IP"]=""
  ["FLASK_PORT"]="5000"
  ["HOST_IP"]="$(get_host_ip)"
  ["ROS_PORT"]="8000"
  ["FLASK_DEBUG"]="0"
  ["PYTHONUNBUFFERED"]="TRUE"
  ["PORT"]="5000"
  ["REST_SERVER_PORT"]="5000"
  ["ROBOT_NAME"]="Sawyer"
  ["MQTT_BROKER_URL"]="mqtt://mosquitto:1883"
  ["MQTT_BROKER_USERNAME"]=""
  ["MQTT_BROKER_PASSWORD"]=""
  ["UID"]="$(id -u)"
  ["GID"]="$(id -g)"
  ["NODE_PATH"]="/nodes"
  ["NODE_RED_PORT"]=1880
  ["NODE_RED_PORT_GROUP1"]=1881
  ["NODE_RED_LOG_LEVEL_GROUP1"]=info
  ["NODE_RED_PORT_GROUP2"]=1882
  ["NODE_RED_LOG_LEVEL_GROUP2"]=info
)

# Print menu to ask for values. Pressing Enter uses the standart-values defined above
#   ["NODE_ENV"] is either dev or prod
echo "Enter your preferred environment variable or press [Enter] to choose the default value."
for key in "${!std_env_vars[@]}"; do
  read -r -p "$key (${std_env_vars[$key]}): " value
  if [[ -n $value ]]; then
    std_env_vars[$key]=$value
  fi
done

# Create .env file.
echo "# Generated .env-file" >.env
for key in "${!std_env_vars[@]}"; do
  echo "$key=${std_env_vars[$key]}" >>.env
done

echo ".env-Datei wurde erfolgreich erstellt."
