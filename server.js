// Slack bot that interacts with 3dmol.js to enable Slack users to view 3D
// molecules via an external link. See README for more info.

//
// Dependencies
//

const Stream = require('stream');
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const isUrl = require('is-url');
const mkdirp = require('mkdirp');
const readline = require('readline');
const request = require('request');
const {WebClient} = require('@slack/client');

//
// Constants
//

const PORT = process.env.PORT;

// The URL of the app itself
const APP_URL = process.env.MOVES_APP_URL;

// Base URL for 3dmol.js and options for viewing
const VIEWER_URL = 'http://3dmol.csb.pitt.edu/viewer.html?url=';
const VIEWER_OPTIONS = '&style=stick:colorscheme~Jmol';

// For matching URL's that come from Slack files
const SLACK_URL_PATT = /^https?.*\.slack\.com\/files\/.*\/(.*)\/.*$/;

// Error messages
const ERROR_FILETYPE = 'Sorry, that filetype is not supported.';
const ERROR_URL = 'Sorry, that is not a URL to a file.';
const ERROR_FILE_NOT_FOUND =
    'Sorry, that file could not be found. It may be on another Slack.';

// Molecule file types that the app supports
const MOL_TYPES = new Set(['pdb', 'sdf', 'mol2', 'xyz', 'cube']);

// Time before a file is deleted - 1 day
const DELETE_TIME = 86400000;

// How many file downloads the server should wait for before doing a deletion
// sweep.
const SWEEP_FREQ = 10;

// Name of directory for storing filenames
const MOL_DIRNAME = './molecules';

// URL mount point for molecules directory
const MOL_URL_MOUNT = 'molecules';

// Dictionary where each team is identified by its id and has an oauth and
// webclient associated with it.
const TEAMS = {};

// Name of the file containing the team ID's and OAuth tokens.
const TEAM_CSV = './teams.csv';

const app = express();

//
// functions
//

// Creates a directory for the app's files and prints a debugging message
// stating so.
function createDirectory() {
  mkdirp(MOL_DIRNAME, function(err) {
    if (err) {
      console.error(err);
    } else {
      console.log('Created directory for storing molecule files.');
    }
  });
}

// Adds a team to the TEAMS dictionary
function addTeam(teamId, oauth) {
  TEAMS[teamId] = {oauth: oauth, webclient: new WebClient(oauth)};
  console.log(`Team ${teamId} has been added`);
}

// Reads teams from the csv file.
function readExistingTeams() {
  console.log('Reading in existing teams');
  fs.stat(TEAM_CSV, (err, stats) => {
    if (err) {
      return;
    } else {
      const rl = readline.createInterface(
          {input: fs.createReadStream(TEAM_CSV), output: new Stream});
      rl.on('line', (line) => {
        tokens =
            line.split(','); // There won't be commas in other parts of input
        addTeam(tokens[0], tokens[1]);
      });
    }
  });
}

// Runs any initializations for the app
function init() {
  createDirectory();
  readExistingTeams();
}

// Saves all teams to the csv file.
function saveTeams(callback) {
  console.log('Saving existing teams');
  data = Object.keys(TEAMS).map((team) => `${team},${TEAMS[team].oauth}`);
  fs.writeFile(TEAM_CSV, data.join('\n'), callback);
}

// Tells whether the given URL is one that came from a file on Slack and hence
// can be parsed for a file ID.
function isSlackUrl(url) {
  return SLACK_URL_PATT.test(url);
}

// Checks whether the given file has an extension that 3dmol.js supports.
function validFileType(filename) {
  const pos = filename.lastIndexOf('.');
  return !(pos == -1 || !MOL_TYPES.has(filename.substr(pos + 1)));
}

// Generates the 3dmol.js link to the file given the URL to the file.
function generateViewerUrl(fileUrl) {
  return `${VIEWER_URL}${fileUrl}${VIEWER_OPTIONS}`;
}

// Downloads the given Slack file and saves it to the given filename (the
// filename can also be a path). Also prints a debugging message that this has
// happened.
function downloadFile(teamId, link, fullFilename) {
  request({
    url: link,
    headers: {
      Authorization: 'Bearer ' + TEAMS[teamId].oauth,
    },
  }).pipe(fs.createWriteStream(fullFilename));
  console.log(`Saved ${fullFilename}`);
}

// Deletes a file in the molecule directory if it is outdated. Prints a
// debugging message stating this has happened.
function deleteMoleculeFile(filename) {
  fileDate = parseInt(filename);
  const d = new Date();
  if (d.getTime() - fileDate > DELETE_TIME) {
    fs.unlink(`${MOL_DIRNAME}/${filename}`, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log(`Deleted ${filename}`);
      }
    });
  }
}

// Every SWEEP_FREQ calls, iterates through all files in the directory and
// deletes them if they are old enough. Also updates the sweepCount, a static
// variable that allows us to count calls.
function deletionSweep() {
  if (typeof deletionSweep.sweepCount == 'undefined') {
    deletionSweep.sweepCount = 0;
  }

  if (deletionSweep.sweepCount == 0) {
    console.log('Performing deletion sweep');
    fs.readdir(MOL_DIRNAME, (err, files) => {
      if (err) {
        console.log(err);
      } else {
        files.forEach(deleteMoleculeFile);
      }
    });
  }

  deletionSweep.sweepCount = (deletionSweep.sweepCount + 1) % SWEEP_FREQ;
}

// Creates a URL where the user may view the given file, or an appropriate error
// message. The callback takes in the URL, as well as another no-parameter
// callback.
function generateUrl(teamId, url, callback) {
  if (isSlackUrl(url)) {
    const fileId = url.match(SLACK_URL_PATT)[1];
    TEAMS[teamId]
        .webclient.files.info({file: fileId})
        .then((res) => {
          // Check file type
          if (!validFileType(res.file.name)) {
            callback(ERROR_FILETYPE, () => {});
            return;
          }

          const d = new Date();
          const filename = `${d.getTime()}_${res.file.name}`;
          const fullFilename = `${MOL_DIRNAME}/${filename}`;
          const serverFileUrl = `${APP_URL}/${MOL_URL_MOUNT}/${filename}`;

          callback(generateViewerUrl(serverFileUrl), () => {
            console.log(`Successfully accessed Slack file ${url}`);
            deletionSweep();
            downloadFile(teamId, res.file.url_private, fullFilename);
          });
        })
        .catch((error) => {
          console.log(`Tried and failed to access Slack file ${url}`);
          callback(ERROR_FILE_NOT_FOUND, () => {});
        });
  } else if (isUrl(url)) {
    console.log(`Generated link to ${url}`);
    callback(generateViewerUrl(url), () => {});
  } else {
    console.log(`Received a non-url: ${url}`);
    callback(ERROR_URL, () => {});
  }
}

//
// app configuration
//

// Serve molecule files
app.use(`/${MOL_URL_MOUNT}`, express.static(MOL_DIRNAME));

// Slack sends requests in the format of 'application/x-www-form-urlencoded'
app.use(bodyParser.urlencoded({extended: true}));

// Home page; helps tell if the app is running.
app.get('/', function(req, res) {
  res.end(fs.readFileSync('index.html'));
});

// Accepts requests to view molecules at the given URL.
app.post('/view', function(req, res) {
  // Generates a response to Slack, then calls fileFn, which is a function that
  // potentially downloads files from Slack and does a deletion sweep. fileFn
  // must be executed after the response is sent to avoid timing out.
  generateUrl(req.body.team_id, req.body.text, (url, fileFn) => {
    res.json({
      response_type: 'in_channel',
      text: url,
    });
    res.end();
    fileFn();
  });
});

// Provides an "Add to Slack" button.
app.get('/auth', function(req, res) {
  res.end(fs.readFileSync('add_to_slack.html'));
});

// Obtains a workspace's OAuth token when installing to a new workspace.
app.get('/auth/redirect', function(req, res) {
  const options = {
    uri: 'https://slack.com/api/oauth.access?code=' + req.query.code +
        '&client_id=' + process.env.SLACK_CLIENT_ID +
        '&client_secret=' + process.env.SLACK_CLIENT_SECRET +
        '&redirect_uri=' + process.env.MOVES_APP_URL + '/auth/redirect',
    method: 'GET',
  };
  request(options, (error, response, body) => {
    const JSONresponse = JSON.parse(body);
    addTeam(JSONresponse.team_id, JSONresponse.access_token);

    // Send the user a response message
    if (!JSONresponse.ok) {
      res.send('Error encountered: \n' + JSON.stringify(JSONresponse))
          .status(200)
          .end();
    } else {
      res.send('Success!');
    }
  });
});

//
// signal handling
//

// Performs any actions and exits the program gracefully.
function handleExit() {
  saveTeams(() => {
    process.exit(0);
  });
}

process.on('SIGINT', handleExit); // Sent by Ctrl-C
process.on('SIGTERM', handleExit); // Sent by heroku
process.on('SIGUSR2', handleExit); // Sent by nodemon

//
// Startup
//

init();
app.listen(PORT, () => console.log(`MOVES now running on ${PORT}`));
