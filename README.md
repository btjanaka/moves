# MOVES - MOlecule ViEwer for Slack

In the field of computational chemistry, the ability to quickly and easily view
molecules is incredibly important. Currently, many research groups, such as the
Mobley Lab at UCI, use Slack for communication purposes. When they share
molecule files, they are required to download the file and open it in a local
viewer. This greatly hampers the efficiency of communication; furthermore, it
makes it nearly impossible to view molecules on the go. MOVES is a Slack app
that solves this problem. By interfacing with
[3Dmol.js](http://3dmol.csb.pitt.edu/index.html), MOVES enables users to view
molecules without the need for any external viewer.


## Usage

MOVES is invoked as a slash command within Slack:
```
/moves [file URL]
```
The file URL can be a link to:
* A molecule file on the team's Slack\*
* A molecule file on some external link

After the file URL is passed via the slash command, MOVES will return a link
where the file may be viewed using 3dmol.js, or an appropriate error message.

\* This must be a link to a file, not a link to a message with a file. You can
obtain this link by obtaining over the top right corner of the preview, clicking
on the three dots that appear, and clicking "Copy link to file".

### Errors

The following errors may occur when using MOVES.

__Slack may give a timeout error for MOVES. This happens becaues the MOVES
server may be inactive (It runs on a free account on Heroku, which puts the
server to sleep after 30 minutes of inactivity). If this occurs, wait a few
seconds and try it again.__

If the file is a Slack file link, MOVES will check the following:
* The file is one of the supported molecule file types
* The file is on the correct Slack (i.e. MOVES can access it)
If any of these conditions are not satisfied, an appropriate error message is
returned.

If the file is an external link or a Slack link (but not to a file), MOVES
performs no checks. Instead, if the file is invalid, 3dmol.js will show no
molecule.

If the file is not a URL, an appropriate message is returned.

### Link Persistence

When given a Slack file link, MOVES downloads the file and stores it. After
approximately 24 hours, the file is permitted to be deleted and will be removed
in the next "sweep". __This means that links for Slack files are not guaranteed
to be valid after 24 hours.__

Other files do not suffer this problem and will work as long as the link to the
original file works.


## Filetypes Supported

The filetypes MOVES supports are based entirely on the ones that 3Dmol.js
supports. As of writing, these filetypes are `pdb`, `sdf`, `mol2`, `xyz`, and
`cube`.


## Credits

Many thanks to Dr. Mobley and his Mobley Lab for coming up with the idea for
this app!
