// Slack bot that interacts with viewer.js to enable Slack users to view 3D
// molecules via an external link.
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const mkdirp = require('mkdirp');
const request = require('request');
const {WebClient} = require('@slack/client');
const {createEventAdapter} = require('@slack/events-api');


const API_KEY = process.env.MOVES_API_KEY;
const APP_URL = process.env.MOVES_APP_URL;
const SLACK_SECRET = process.env.SLACK_SECRET;
const VIEWER_URL = 'http://3dmol.csb.pitt.edu/viewer.html?url=';
const PORT = 3000;

// Molecule file types that the app supports
const MOL_TYPES = new Set(['pdb', 'sdf', 'mol2', 'xyz', 'cube']);

// Time before a file is deleted - 1 day
const DELETE_TIME = 86400000;


const app = express();
const slackEvents = createEventAdapter(SLACK_SECRET);
const web = new WebClient(API_KEY);


// Mount slack events here
app.use('/slack/events', slackEvents.expressMiddleware());

// Serve molecule files
app.use('/molecules', express.static('./molecules'));

// Slack sends requests in the format of 'application/x-www-form-urlencoded'
app.use(bodyParser.urlencoded({extended: true}));


// Checks whether the given file has an extension that 3dmol.js supports.
function validFileType(filename) {
  const pos = filename.lastIndexOf('.');
  return !(pos == -1 || !MOL_TYPES.has(filename.substr(pos + 1)));
}

// Downloads the given Slack file and saves it to the given filepath.
// Also prints a debugging message that this has happened.
function downloadFile(link, fullFilename) {
  request({
    url: link,
    headers: {
      Authorization: 'Bearer ' + API_KEY,
    },
  }).pipe(fs.createWriteStream(fullFilename));
  console.log(`Saved ${fullFilename}`);
}

// Sets a timer for deleting the given file.
function setDeletionTimer(fullFilename) {
  setTimeout(function() {
    fs.unlink(fullFilename, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log(`Deleted ${fullFilename}`);
      }
    });
  }, DELETE_TIME);
}

// Posts a message to the channel where the file upload originated,
// telling the link where the user can view the molecule.
function notifyChannel(channelID, originalFilename, viewerFileUrl) {
  web.chat.postMessage({
    channel: channelID,
    text: `View ${originalFilename} here: ${viewerFileUrl}`,
  });
}

// Replies to a user's file_shared event with a link to the site where they may
// view it.
slackEvents.on('file_shared', (event) => {
  web.files.info({file: event.file_id})
      .then((res) => {
        // Check file types
        if (!validFileType(res.file.name)) return;

        const d = new Date();
        const filename = `${d.getTime()}_${res.file.name}`;
        const fullFilename = `./molecules/${filename}`;
        const serverFileUrl = `${APP_URL}/molecules/${filename}`;
        const viewerFileUrl = `${VIEWER_URL}${serverFileUrl}`;

        downloadFile(res.file.url_private, fullFilename);
        setDeletionTimer(fullFilename);
        notifyChannel(res.file.channels[0], res.file.name, viewerFileUrl);
      })
      .catch(console.error);
});

// Handle errors for Slack
slackEvents.on('error', console.error);

mkdirp('molecules', function(err) {
  if (err) {
    console.error(err);
  } else {
    console.log('Created directory for storing molecule files.');
  }
});
app.listen(PORT, () => console.log(`MOVES now running on ${PORT}`));
