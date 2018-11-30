// Slack bot that interacts with 3dmol.js to enable Slack users to view 3D
// molecules via an external link.

//
// Dependencies
//
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const mkdirp = require('mkdirp');
const request = require('request');
const {WebClient} = require('@slack/client');
const isUrl = require('is-url');

//
// Constants
//
const API_KEY = process.env.MOVES_API_KEY;
const APP_URL = process.env.MOVES_APP_URL;
const VIEWER_URL = 'http://3dmol.csb.pitt.edu/viewer.html?url=';
const VIEWER_OPTIONS = '&style=stick';
const PORT = process.env.PORT;

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

const app = express();
const web = new WebClient(API_KEY);

// Serve molecule files
app.use(`/${MOL_URL_MOUNT}`, express.static(MOL_DIRNAME));

// Slack sends requests in the format of 'application/x-www-form-urlencoded'
app.use(bodyParser.urlencoded({extended: true}));


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
function downloadFile(link, fullFilename) {
  request({
    url: link,
    headers: {
      Authorization: 'Bearer ' + API_KEY,
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
// message. The callback fn takes in the URL, as well as another no-parameter
// callback.
function generateUrl(url, fn) {
  if (isSlackUrl(url)) {
    const fileId = url.match(SLACK_URL_PATT)[1];
    web.files.info({file: fileId})
        .then((res) => {
          // Check file type
          if (!validFileType(res.file.name)) {
            fn(ERROR_FILETYPE, () => {});
            return;
          }

          const d = new Date();
          const filename = `${d.getTime()}_${res.file.name}`;
          const fullFilename = `${MOL_DIRNAME}/${filename}`;
          const serverFileUrl = `${APP_URL}/${MOL_URL_MOUNT}/${filename}`;

          fn(generateViewerUrl(serverFileUrl), () => {
            deletionSweep();
            downloadFile(res.file.url_private, fullFilename);
          });
        })
        .catch((error) => {
          fn(ERROR_FILE_NOT_FOUND, () => {});
        });
  } else if (isUrl(url)) {
    fn(generateViewerUrl(url), () => {});
  } else {
    fn(ERROR_URL, () => {});
  }
}

// Accepts requests to view molecules at the given URL.
app.post('/view', function(req, res) {
  // Send the response and then run a function that does a deletion sweep and
  // possibly downloads the file. This downloading must occur after in order to
  // guarantee the response is sent back before Slack times out.
  generateUrl(req.body.text, (url, fileFn) => {
    res.json({
      response_type: 'in_channel',
      text: url,
    });
    res.end();
    fileFn();
  });
});

// Default page
app.get('/', function(req, res) {
  res.end(fs.readFileSync('index.html'));
});

createDirectory();
app.listen(PORT, () => console.log(`MOVES now running on ${PORT}`));
