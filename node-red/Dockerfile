FROM nodered/node-red:3.0.2-16-minimal

#Start script
COPY run.sh entrypoint.sh

#Install Nodes
COPY npmInstall.sh npmInstall.sh


RUN npm install ws nodemon #Websocket-Library and Nodemon

USER root
RUN apk add avahi-tools # Network Discovery Tools

USER node-red

ENTRYPOINT ["bash","./entrypoint.sh"]

