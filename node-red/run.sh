# #!/usr/bin/env bash

# cp settingsTemplate.js /data/settings.js

# #Set Environment. dev for development, prod for productiopn
# if [ "$NODE_ENV" == "dev" ]; then
#     nodemon --watch /nodes/ \
#     -e js,html,py,json \
#     --exec "rm -rf nodes/* && cp -R /nodes . && ./npmInstall.sh"
# else
#     cp -R /nodes . && ./npmInstall.sh && npm start
# fi

#!/bin/sh

cp settingsTemplate.js /data/settings.js

nodemon --watch /nodes/ \
-e js,html,py,json \
--exec "rm -rf nodes/* && cp -R /nodes . && ./npmInstall.sh"

