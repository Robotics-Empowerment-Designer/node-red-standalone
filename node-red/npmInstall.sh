#!/bin/bash

# add new robot modules here
packages=(./nodes/pepper/ ./nodes/temi/ ./nodes/sawyer/ ./nodes/base/)

for i in "${packages[@]}"; do
   :
   # npm install $i --no-audit --progress=false --no-fund
   npm install $i --no-audit --progress=false
done

node-red start -v --userDir /data $FLOWS
