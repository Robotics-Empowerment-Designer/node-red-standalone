# Steroids Control

This is a simple control panel for the Node-RED instance running on the server.

## Setup

1. Follow the deployment instructions in `DEPLOYMENT.md`
2. Install Node.js using any method. We will use [nvm](https://github.com/nvm-sh/nvm) to install Node.js on the system
3. We will use Node version `17`, but others might work too
```bash
nvm install 17
```
```bash
nvm use 17
```

4. Clone this repository as the `root` user or any user that is in the `docker` group.
5. Install the systemd-service
```bash
systemctl edit --full --force steroids-control.service
```

6. Paste the following into the editor and save the file
```
[Unit]
Description=Steroids Control App
After=network.target

[Service]
ExecStart=/root/.nvm/versions/node/v17.9.1/bin/node /root/git/node-red-standalone/steroids-control/server.js
Restart=always
User=root
Group=root
Environment=NODE_ENV=production
WorkingDirectory=/root/git/node-red-standalone/steroids-control/

[Install]
WantedBy=multi-user.target
```

7. Make sure to edit the path of the repository and the node installation. You can get the path of the `node` executable using `which node`.
8. Also make sure to edit the user and group if you want to use a different user to manage docker.
9. You also need to change the path of the docker compose files. You need to do this in `steroids-control/bash/*.sh`.
10. Enable the service on startup and start the service
```bash
systemctl enable --now steroids-control.service
```
