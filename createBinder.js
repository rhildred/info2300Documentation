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
    var sFile = `${__dirname}${aFiles[nFile++]}`;
    sHtml = "<h2 class=\"chapter\">" + path.basename(sFile).replace(/\+/g, " ").replace(".md", "") + "</h2>";
    fs.readFile(sFile, 'utf8', (err, data) => {
        if (err) throw err;
        sHtml += converter.makeHtml(data.replace(/[“”]/g, "\""));
        // get relative dir to this file
        var sDir = path.dirname(sFile).replace(`${__dirname}/`, "");
        sHtml = sHtml.replace("img src=\"images", `img src="${sDir}/images`);
        streamOutfile.write(sHtml, (err) => {
            if (err) throw err;
            if (nFile < aFiles.length) {
                next();
            } else {
                // we are done here
                streamOutfile.end();
                doc.end();
                // now we should start over but only once
                if (bFirstTime) {
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

const nextLinePossiblyPage = (bNonContinuous = false) => {
    if (doc._wrapper) {
        if (doc._wrapper.startY > doc.page.height - doc.page.margins.top - doc.page.margins.bottom) {
            doc.text("").moveDown().addPage();
        } else {
            doc.text("").moveDown();
        }
    } else {
        let nHeight = doc.heightOfString("test", { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
        if (doc.y + nHeight >= doc.page.height - doc.page.margins.bottom) {
            doc.moveDown().addPage();
        }
        if (!bNonContinuous) {
            // sorry about the double negative here
            doc.text("").moveDown();
        }
    }
}

const printTableOfContents = () => {
    doc.fontSize(16).font('Helvetica');;
    doc.text("Table of Contents").moveDown().fontSize(12).font("Times-Roman");
    //offset the page numbers by the TOC.
    let nOffset = Math.ceil(aChapters.length * doc._fontSize * 2 / (doc.page.height - doc.page.margins.top - doc.page.margins.bottom));
    for (var n = 0; n < aChapters.length; n++) {
        nextLinePossiblyPage(true);
        var nPos = doc.y;
        doc.text(aChapters[n].name, { align: "left" });
        doc.y = nPos;
        doc.text(aChapters[n].pageNumber + nOffset, { align: "right" }).moveDown();
    }
}

const printTitlePage = () => {
    var oPackage = require(__dirname + "/package.json");
    var sName = oPackage.name;
    var sAuthor = oPackage.author;
    doc.fontSize(24).font('Helvetica');
    doc.y = .5 * (doc.page.height);
    doc.text(sName, { align: "center" });
    doc.moveDown().fontSize(12).font("Times-Roman");
    doc.text(sAuthor, { align: "right" });
    doc.moveDown().addPage();
}

var streamOutfile = null;
var parser = null;
var doc = null;

const main = (bFirstTime) => {
    doc = new PDFDocument();
    // Pipe its output somewhere, like to a file or HTTP response
    // See below for browser usage
    doc.pipe(fs.createWriteStream(sFilename.replace("json", "pdf")));
    var pageNumber = 1;
    doc.font("Times-Roman");
    doc.on('pageAdded',
        function () {
            // Don't forget the reset the font family, size & color if needed
            var nLine = doc.y;
            doc.fontSize(11);
            doc.text(pageNumber++, { align: 'center' });
            doc.y = nLine;
            doc.text(sChapter, { align: "right" }).moveDown();
            doc.fontSize(12);
        }
    );
    if (!bFirstTime) {
        printTitlePage();
        printTableOfContents();

    }

    streamOutfile = new stream.Transform({ objectMode: true });

    streamOutfile._transform = function (chunk, encoding, done) {
        this.push(chunk);
        done();
    }
    parser = new SAXParser();
    // Called whenever an opening tag is found in the document,
    // such as <example id="1" /> - see below for a list of events
    var sChapter = "";
    let aRow = []; //for tables
    let aCurState = [];
    aCurState.push("body");
    let aNumbers = []; //for ordered lists
    let oParsers = {
        p: {
            onStart: () => {

            },
            onText: (oText) => {
                doc.text(oText.text, { continued: true });
            },
            onEnd: () => {
                nextLinePossiblyPage();
            }
        },
        img: {
            onStart: (tag) => {
                for (n = 0; n < tag.attrs.length; n++) {
                    if (tag.attrs[n].name == "src") {
                        if (doc.y > .75 * (doc.page.height - doc.page.margins.bottom - doc.page.margins.top)) {
                            //don't start after 75%
                            doc.moveDown().addPage();
                        }
                        try {
                            doc.image(tag.attrs[n].value, { fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, doc.page.height - doc.y - doc._fontSize - doc.page.margins.bottom - doc.page.margins.top] });

                        } catch (e) {
                            console.log(e);
                        }
                    }
                }
                aCurState.pop();

            }

        },
        h: {
            onStart: (tag, nLevel) => {
                doc.font('Helvetica');
                doc.fontSize(18 - nLevel * 2);
                // don't want to start past .75 of the page
                if (doc.y > .85 * (doc.page.height - doc.page.margins.top - doc.page.margins.bottom)) {
                    doc.addPage().moveDown();
                } else {
                    doc.moveDown();
                }
            },
            onText: (oText) => {
                doc.text(oText.text, { continued: true });
            },
            onEnd: () => {
                nextLinePossiblyPage();
                doc.font('Times-Roman');
                doc.fontSize(12);
            }
        },
        em: {
            onStart: () => {
                let bAlsoStrong = false;
                for (n = 0; n < aCurState.length; n++) {
                    if (aCurState[n] == "strong") {
                        bAlsoStrong = true;
                    }
                }
                if (bAlsoStrong) {
                    doc.font('Times-BoldItalic');
                } else {
                    doc.font('Times-Italic');
                }

            }
            ,
            onText: (oText) => {
                if (aRow.length > 0) {
                    // we are in a table and need to save up the text
                    aRow[aRow.length - 1] += oText.text;
                } else {
                    doc.text(oText.text, { continued: true });
                }
            },
            onEnd: () => {
                let bAlsoStrong = false;
                for (n = 0; n < aCurState.length; n++) {
                    if (aCurState[n] == "strong") {
                        bAlsoStrong = true;
                    }
                }
                if (bAlsoStrong) {
                    doc.font('Times-Bold');
                } else {
                    doc.font('Times-Roman');
                }

            }
        },
        strong: {
            onStart: () => {
                let bAlsoEM = false;
                for (n = 0; n < aCurState.length; n++) {
                    if (aCurState[n] == "em") {
                        bAlsoEM = true;
                    }
                }
                if (bAlsoEM) {
                    doc.font('Times-BoldItalic');
                } else {
                    doc.font('Times-Bold');
                }

            }
            ,
            onText: (oText) => {
                if (aRow.length > 0) {
                    // we are in a table and need to save up the text
                    aRow[aRow.length - 1] += oText.text;
                } else {
                    doc.text(oText.text, { continued: true });
                }
            },
            onEnd: () => {
                let bAlsoEM = false;
                for (n = 0; n < aCurState.length; n++) {
                    if (aCurState[n] == "em") {
                        bAlsoEM = true;
                    }
                }
                if (bAlsoEM) {
                    doc.font('Times-Italic');
                } else {
                    doc.font('Times-Roman');
                }


            }
        },

        table: {
            onStart: () => {
                // don't want to start past .75 of the page
                if (doc.y > .75 * (doc.page.height - doc.page.margins.top - doc.page.margins.bottom)) {
                    doc.addPage().moveDown();
                } else {
                    nextLinePossiblyPage();
                }

            }
            ,
            onText: (oText) => {

            },
            onEnd: () => {

            }
        },
        tr: {
            onStart: () => {
                aRow = [];
            }
            ,
            onText: (oText) => {

            },
            onEnd: () => {
                //process the saved row here
                const nPadX = 12;
                const nPadY = 6;
                let nColWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / aRow.length;
                // measure tallest column
                nHighestHeight = 0;
                for (let n = 0; n < aRow.length; n++) {
                    nHeight = doc.heightOfString(aRow[n], { width: nColWidth - nPadX });
                    if (nHeight > nHighestHeight) {
                        nHighestHeight = nHeight;
                    }
                }
                // make sure that the row will fit on the page
                if (doc.y + nHighestHeight > doc.page.height - doc.page.margins.bottom - doc.page.margins.top) {
                    doc.addPage().moveDown();
                }
                let nStartX = doc.x;
                let nStartY = doc.y;
                // render the columns
                for (let n = 0; n < aRow.length; n++) {
                    doc.y = nStartY;
                    doc.text(aRow[n], { width: nColWidth - nPadX });
                    doc.x += nColWidth;
                }
                doc.y = nStartY + nHighestHeight + nPadY;
                doc.x = nStartX;
                aRow = [];
                //nextLinePossiblyPage();

            }
        },
        th: {
            onStart: () => {
                aRow.push("");
            }
            ,
            onText: (oText) => {
                aRow[aRow.length - 1] += oText.text;
            },
            onEnd: () => {

            }
        },
        td: {
            onStart: () => {
                aRow.push("");
            }
            ,
            onText: (oText) => {
                aRow[aRow.length - 1] += oText.text;
            },
            onEnd: () => {

            }
        },
        thead: {
            onStart: () => {
                doc.font("Times-Bold");
            }
            ,
            onText: (oText) => {

            },
            onEnd: () => {
                doc.font("Times-Roman");

            }
        },
        tbody: {
            onStart: () => {

            }
            ,
            onText: (oText) => {

            },
            onEnd: () => {

            }
        },

        chapter: {
            onStart: () => {

            }
            ,
            onText: (oText) => {
                sChapter = oText.text;
                aChapters.push({ name: sChapter, pageNumber: pageNumber })
                doc.text("").moveDown().addPage();
                doc.font('Helvetica').fontSize(18).y = doc.page.height * 0.25;
                doc.text(sChapter, { align: "right" }).moveDown();
                doc.fontSize(12).font('Times-Roman');
            },
            onEnd: () => {

            }
        },
        br: {
            onStart: () => {
                aCurState.pop();
                //doc.text(""); //just eat them

            }

        },
        wordInAngles: {
            onStart: (tag) => {
                let sAttrs = "";
                for (n = 0; n < tag.attrs.length; n++) {
                    sAttrs += " " + tag.attrs[n].name;
                }
                doc.text("<" + aCurState.pop() + sAttrs + ">", { continued: true });
            }

        },
        ul: {
            onStart: () => {
            }
            ,
            onText: (oText) => {

            },
            onEnd: () => {
                //lists can be nested
                nextLinePossiblyPage();

            }
        },
        ol: {
            onStart: () => {
                aNumbers.push(0);
            }
            ,
            onText: (oText) => {

            },
            onEnd: () => {
                //lists can be nested
                nextLinePossiblyPage();
                aNumbers.pop();
            }
        },
        li: {
            onStart: () => {
                sListType = "";
                for (let n = aCurState.length - 1; n > 0; n--) {
                    if (aCurState[n].search(/l$/) != -1) {
                        sListType = aCurState[n];
                    }
                }
                sIndent = "";
                nIndent = 0;
                for (let n = 0; n < aCurState.length; n++) {
                    if (aCurState[n].search(/l$/) != -1) {
                        sIndent += "    ";
                        nIndent++;
                    }
                }
                nextLinePossiblyPage();
                if (sListType == "ul") {
                    doc.text(sIndent + "• ", { continued: true });
                } else {
                    aNumbers[nIndent - 1]++;
                    doc.text(sIndent + aNumbers.join(".") + ")  ", { continued: true });
                }
            }
            ,
            onText: (oText) => {
                doc.text(oText.text, { continued: true });
            },
            onEnd: () => {
            }
        },
        a: {
            href: "",
            onStart: (tag) => {
                let bHref = false;
                let sAttrs = "";
                for (n = 0; n < tag.attrs.length; n++) {
                    sAttrs += " " + tag.attrs[n].name;
                    if (tag.attrs[n].name == "href") {
                        this.href = tag.attrs[n].value;
                        bHref = true;
                    }
                }
                if (!bHref) {
                    //we have an a with a < sign
                    doc.text("<" + aCurState.pop() + sAttrs + ">", { continued: true });

                }

            }
            ,
            onText: (oText) => {
                if (this.href != oText.text) {
                    doc.text(oText.text + "(" + this.href + ")", { continued: true });
                } else {
                    doc.text(oText.text, { continued: true });
                }
            },
            onEnd: () => {

            }
        },

        body: {
            onText: () => {
            },
        }


    }


    parser.on('startTag', tag => {
        //console.log(tag.tagName);

        for (n = 0; n < tag.attrs.length; n++) {
            if (tag.attrs[n].name == "class" && -1 != tag.attrs[n].value.search("chapter")) {
                tag.tagName = "chapter";
            }

        }
        if (tag.tagName.search(/^h/) != -1) {
            aCurState.push("h");
            oParsers.h.onStart(tag, tag.tagName.substr(1));
        } else {
            aCurState.push(tag.tagName);
            try {
                oParsers[tag.tagName].onStart(tag);

            } catch (e) {
                oParsers.wordInAngles.onStart(tag);
            }
        }
    });

    parser.on("text", oText => {
        let sCurState = aCurState[aCurState.length - 1];
        try {
            // no place for newlines in .html
            oText.text = oText.text.replace("\n", "");
            oParsers[sCurState].onText(oText);
        } catch{
            console.log("No onText method for " + sCurState);
        }
    });

    parser.on("endTag", tag => {
        let sTag = aCurState.pop();
        if (sTag != tag.tagName && !(sTag == "chapter" && tag.tagName[0] == "h")
            && !(sTag == "h" && tag.tagName[0] == "h")) {
            //don't want to leave it hanging
            aCurState.push(sTag);
        }
        try {
            oParsers[sTag].onEnd();
        } catch{
            console.log("end tag " + tag.tagName + " encountered " + sTag + " was current");
        }
    });

    parser.on("error", err => console.log(err));
    streamOutfile.pipe(parser);
    next();

}

main(true);