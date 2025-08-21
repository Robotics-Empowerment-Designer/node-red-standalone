#!/bin/bash

# add new robot modules here
packages=(./nodes/pepper/ ./nodes/temi/ ./nodes/sawyer/ ./nodes/base/)

for i in "${packages[@]}"; do
   if [ -d "$i" ] && [ -f "$i/package.json" ]; then

      # npm install $i --no-audit --progress=false --no-fund
      npm install $i --no-audit --progress=false
   else
      echo "Skipping $i (directory package.json not found)"
   fi
done

node-red start -v --userDir /data $FLOWS
