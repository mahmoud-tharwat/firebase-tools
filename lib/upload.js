var request = require('request'),
    auth = require('./auth'),
    api = require('./api'),
    fstreamIgnore = require('fstream-ignore'),
    tar = require('tar'),
    zlib = require('zlib'),
    temp = require('temp'),
    fs = require('fs'),
    path = require('path'),
    chalk = require('chalk');

temp.track();

module.exports = {
  send: function(firebase, publicDir, ignoreRules, pushId, message, callback) {
    var writeStream = temp.createWriteStream({ suffix: '.tar.gz' }),
        filename = writeStream.path,
        fileCount = 0,
        foundIndex = false,
        indexPath = path.resolve(path.join(publicDir, 'index.html'));

    console.log('Preparing to deploy Public Directory...');

    var reader = fstreamIgnore({
        path: publicDir,
        type: 'Directory',
        follow: true,
        filter: function() {
          if (this.type !== 'Directory') {
            fileCount += 1;
          }
          if (this.path === indexPath) {
            foundIndex = true;
          }
          return true;
        }
      });

    reader.addIgnoreRules(ignoreRules);

    reader.pipe(tar.Pack())
      .pipe(zlib.createGzip())
      .pipe(writeStream);

    writeStream.once('finish', function() {
      if (fileCount === 0) {
        console.log(chalk.yellow('Public Directory Warning') + ' - Public ' +
                        'directory is empty, removing site');
      } else if (!foundIndex) {
        console.log(chalk.yellow('Public Directory Warning') + ' - Public ' +
                        'directory does not contain an index.html\n' +
                        'Make sure you\'re deploying the right public directory: ' +
                        chalk.bold(path.resolve(publicDir)));
      }
      var params = ['id=' + encodeURIComponent(pushId), 'fileCount=' + fileCount, 'token=' + auth.token];
      if (message) {
        params.push('message=' + encodeURIComponent(message));
      }
      var url = api.uploadUrl + '/upload/' + firebase + '?' + params.join('&')
      var readStream = fs.createReadStream(filename);

      var r = request.put({
        url: url,
        json: true
      }, function(err, response, body) {
        fs.unlink(filename);
        var failed = (err || !body || !body.success);
        setTimeout(callback, 0, failed, body ? body.directory : undefined);
      });
      var form = r.form();
      form.append('site', readStream);
    });
  }
}