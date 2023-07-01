var fs = require('fs');
var walk = function (dir, done) {
    var results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        var i = 0;
        (function next() {
            var file = list[i++];
            if (!file) return done(null, results);
            file = dir + '/' + file;
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory() && -1 == file.search(/node_modules$/)) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    if (file.search("md$") != -1 && file.search("README") == -1) {
                        results.push(file.replace(__dirname, ""));

                    }
                    next();
                }
            });
        })();
    });
};

walk(__dirname, function (err, results) {
    if (err) throw err;
    var json = JSON.stringify(results, null, 2);
    fs.writeFile('allMarkdown.json', json, 'utf8', ()=>console.log("file written"));

 });