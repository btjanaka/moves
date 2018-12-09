# Script for setting up environment in Heroku
source .env
heroku config:set MOVES_APP_URL=$MOVES_APP_URL
heroku config:set SLACK_CLIENT_ID=$SLACK_CLIENT_ID
heroku config:set SLACK_CLIENT_SECRET=$SLACK_CLIENT_SECRET
heroku config:set SLACK_SIGNING_SECRET=$SLACK_SIGNING_SECRET
heroku config:set AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
heroku config:set AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
heroku config:set S3_BUCKET_NAME=$S3_BUCKET_NAME
heroku config:set S3_BUCKET_URL=$S3_BUCKET_URL
heroku config:set PORT=$PORT
