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

MOVES works as follows. In Slack, MOVES is a bot that listens for file uploads
and shares. Whenever a file is uploaded or shared to a channel which MOVES is a
part of, it automatically generates a link to a webpage where users can view the
molecule using 3Dmol.js.

Note that in order to provide this link, MOVES must download the molecule file,
so that 3Dmol.js can access it without having to be authenticated by Slack. This
has 2 important implications:
1. The links provided are public to some extent, in that anybody with the link
   can view the file.
1. _The link will expire in approximately 24 hours._ To prevent the server from
   running out of space, files are set to be deleted 24 hours after they are
   downloaded. This means that the link will no longer work. This does not mean
   one has to upload the file to Slack again; they can simply share the file
   again.


## Filetypes Supported

The filetypes MOVES supports are based entirely on the ones that 3Dmol.js
supports. As of writing, these filetypes are `pdb`, `sdf`, `mol2`, `xyz`, and
`cube`.


## Credits

* Many thanks to Dr. Mobley and his Mobley Lab for coming up with the idea for
  this app.
