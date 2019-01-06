var fs = require("fs");
var path = require("path");
var sFilename = process.argv.length > 2 ? process.argv.slice(2)[0] : "allMarkdown.json";
var aFiles = require(__dirname + "/" + sFilename)
var showdown = require('showdown'),
    converter = new showdown.Converter({ tables: true });

var nFile = 0;

var streamOutfile = fs.createWriteStream("out.html");

var next = () => {
    var sFile = aFiles[nFile++];
    sHtml = "<h2 class=\"chapter\">" + path.basename(sFile).replace(/\+/g, " ").replace(".md", "") + "</h2>";
    fs.readFile(sFile, 'utf8', (err, data) => {
        if (err) throw err;
        sHtml += converter.makeHtml(data);
        var aDir = path.dirname(sFile).split(path.sep);
        sHtml = sHtml.replace("img src=\"images", "img src=\"" + aDir[aDir.length - 1] + path.sep + "images");
        streamOutfile.write(sHtml, (err) => {
            if (err) throw err;
            if (nFile < aFiles.length) {
                next();
            } else {
                // we are done here
                streamOutfile.end();
            }
        });
    });
}

next();

