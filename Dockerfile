# Dockerfile
FROM nodered/node-red:latest

# Switch to root to handle permissions
USER root

# Copy all custom nodes AND the new workspace package.json
COPY ./node-red/nodes/ /tmp/nodes/

# Set the workspace as the current directory
WORKDIR /tmp/nodes

# A single npm install command will now resolve everything:
# It will link local packages (base, pepper) and download
# all external dependencies (socket.io, got, etc.) for all nodes.
RUN npm install

# Switch back to the main Node-RED directory
WORKDIR /usr/src/node-red

# Install the fully-prepared nodes from the workspace
RUN npm install /tmp/nodes/base /tmp/nodes/pepper /tmp/nodes/temi /tmp/nodes/sawyer
# RUN npm install /tmp/nodes/base /tmp/nodes/temi

# Switch back to the non-root user for security
USER node-red