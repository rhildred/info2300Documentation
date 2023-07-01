# info2300

## This produces a binder from the SDLCDocs for a CAPSTONE project, or any other markdown docs it may come across other than README.md

To produce a .pdf of the SDLCDocs, in an empty folder:

```bash
git clone https://github.com/rhildred/info2300Documentation .
npm install
npm start

```

To recreate the `allMarkdown.json` file containing markdown files in the project:

```bash
node walk.js
```

And to just emit one long .html file with the markdown in it:

```bash
node emit.js
```

I also started with word document templates and made markdown from them. Some of the templates were from the [CDC up](https://www2a.cdc.gov/cdcup/library/templates/). Most were from the Conestoga CAPSTONE shell. To convert the word to markdown I used mammoth. I updated this project in 2023 because I was looking for a way to convert to markdown from word and remembered doing it. Hopefully this will help you with your CAPSTONE or with making multipart documents from markdown files.