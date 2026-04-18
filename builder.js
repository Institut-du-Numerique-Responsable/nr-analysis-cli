const concat = require('concat-files');
const glob = require('glob');
const fs = require('fs');

const DIR = './dist';

if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR);
}

const rules = glob.sync('./nr-core/rules/*.js');

//One script to analyse them all
concat(
    [
        './nr-core/analyseFrameCore.js',
        './nr-core/utils.js',
        './nr-core/rulesManager.js',
        './nr-core/ecoIndex.js',
        ...rules,
        './nr-core/greenpanel.js',
    ],
    './dist/nrBundle.js',
    function (err) {
        if (err) throw err;
        console.log('build complete');
    }
);
