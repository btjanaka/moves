# Script for setting up environment in Heroku
source .env
heroku config:set MOVES_APP_URL=$MOVES_APP_URL
heroku config:set SLACK_CLIENT_ID=$SLACK_CLIENT_ID
heroku config:set SLACK_CLIENT_SECRET=$SLACK_CLIENT_SECRET
heroku config:set SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET
heroku config:set PORT=$PORT
