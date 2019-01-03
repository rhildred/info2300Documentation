var fs = require("fs");
var path = require("path");
var sFilename = process.argv.length > 2 ? process.argv.slice(2)[0] : "allMarkdown.json";
var aFiles = require(__dirname + "/" + sFilename)
var showdown = require('showdown'),
    converter = new showdown.Converter({ tables: true });

var nFile = 0;

var stream = require('stream');

const PDFDocument = require('pdfkit');

var bFirstTime = true;

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
                doc.end();
                // now we should start over but only once
                if(bFirstTime){
                    bFirstTime = false;
                    nFile = 0;
                    main(bFirstTime);
                }

            }
        });
    });
}



const SAXParser = require('parse5-sax-parser');

// Called whenever an opening tag is found in the document,
// such as <example id="1" /> - see below for a list of events
var sChapter = "";

var aChapters = [];


const printTableOfContents = ()=>{
    doc.text("Table of Contents").moveDown();
    for(var n = 0; n < aChapters.length; n++){
        var nPos = doc.y;
        doc.text(aChapters[n].name, {align:"left"});
        doc.y = nPos;
        doc.text(aChapters[n].pageNumber, {align:"right"}).moveDown();
        if(doc.y >= doc.page.height - doc.page.margins.bottom - 2*doc._fontSize){
            doc.addPage();
        }
    }
}

const printTitlePage = () => {
    var oPackage = require(__dirname + "/package.json");
    var sName = oPackage.name;
    var sAuthor = oPackage.author;
    doc.fontSize(24);
    doc.y = .5 * (doc.page.height);
    doc.text(sName, { align: "center" });
    doc.moveDown().fontSize(12);
    doc.text(sAuthor, { align: "right" });
    doc.addPage();
}

var streamOutfile = null;
var parser = null;
var doc = null;

const main = (bFirstTime)=>{
    doc = new PDFDocument();
    // Pipe its output somewhere, like to a file or HTTP response
    // See below for browser usage
    doc.pipe(fs.createWriteStream(sFilename.replace("json", "pdf")));
    var pageNumber = 1;
    doc.on('pageAdded',
        function () {
            // Don't forget the reset the font family, size & color if needed
            var nLine = doc.y;
            doc.fontSize(11);
            doc.text(pageNumber++, { align: 'center' });
            doc.y = nLine;
            doc.text(sChapter, {align:"right"}).moveDown();
            doc.fontSize(12);
        }
    );
    if(!bFirstTime){
        printTitlePage();
        printTableOfContents();
    
    }

    streamOutfile = new stream.Transform({ objectMode: true });

    streamOutfile._transform = function (chunk, encoding, done) {
        this.push(chunk);
        done();
    }
    parser = new SAXParser();
    var bChapter = false;
    // Called whenever an opening tag is found in the document,
    // such as <example id="1" /> - see below for a list of events
    var sChapter = "";
    parser.on('startTag', tag => {
        for (n = 0; n < tag.attrs.length; n++) {
            if (tag.attrs[n].name == "class" && -1 != tag.attrs[n].value.search("chapter")) {
                bChapter = true;
            }
    
        }
    });
    
    parser.on("text", oText => {
    
        if (bChapter) {
            sChapter = oText.text;
            aChapters.push({name: sChapter, pageNumber: pageNumber})
            bChapter = false;
            doc.addPage();
            doc.fontSize(18).y = doc.page.height * 0.5;
            doc.text(oText.text, { align: "right" });
            doc.fontSize(12);
        } else {
            doc.text(oText.text, { align: "left" });
        }
    });
    parser.on("endTag", tag => {
        if (tag.tagName == "p" ||
            tag.tagName.search(/^h/) != -1) {
            if (doc.y >= doc.page.height) {
                doc.addPage();
            } else {
                doc.moveDown();
            }
        }
    });
    
    parser.on("error", err => console.log(err));
    streamOutfile.pipe(parser);
    next();
    
}

main(true);