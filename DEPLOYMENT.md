# Deployment

This document describes the deployment on a fresh installation of Ubuntu Server 24.04 LTS step-by-step.

## Docker setup

1. Become root
```bash
sudo -i
```

2. Update packages
```bash
apt update && apt upgrade -y
```

3. Install `git` (we'll need git later) and `curl`
```bash
apt install git curl
```

4. Use the convenience script from the [Docker website](https://docs.docker.com/engine/install/ubuntu/#install-using-the-convenience-script) to install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
```
```bash
sudo sh get-docker.sh
```

## Node-RED-Standalone setup

1. Create and enter a directory for git
```bash
mkdir -p ~/git && cd ~/git
```

2. Clone the repository and enter the directory
```bash
git clone https://github.com/Robotics-Empowerment-Designer/RED-Platform.git && cd RED-Platform
```
<!-- Alternative repo URL: https://gitlab-fi.ostfalia.de/hcr-lab/visual-programming/node-red-standalone.git -->

3. Run the `combine.sh`-script and follow the instructions
```bash
chmod +x combine.sh && ./combine.sh
```

## Automatic startup

We will set up a systemd-service that manages the Node-RED instance.

1. Create a new systemd-service
```bash
systemctl edit --full --force node-red.service
```

2. Paste the following text into the editor and save the file
```
[Unit]
Description=Node-RED Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
WorkingDirectory=/root/git/RED-Platform
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

3. Enable the service on startup and start the service
```bash
systemctl enable --now node-red.service
```

## WiFi/WLAN setup (optional)

1. Install `network-manager`
```bash
apt install network-manager
```

2. Turn on WiFi
```bash
nmcli r wifi on
```

3. List available networks
```bash
nmcli d wifi list
```

4. Connect to WiFi
```
nmcli d wifi connect <WiFi-SSID> password <password>
```
