const concat = require('concat-files');
const glob = require('glob');
const fs = require('fs');

const DIR = './dist';

if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR);
}

const rules = glob.sync('./nr-core/rules/*.js');
const wsgRules = glob.sync('./nr-core/rules/wsg/*.js');
const a11yChecks = glob.sync('./nr-core/a11y/*.js');

concat(
    [
        './nr-core/analyseFrameCore.js',
        './nr-core/utils.js',
        './nr-core/rulesManager.js',
        ...rules,
        ...wsgRules,
        ...a11yChecks,
        './nr-core/greenpanel.js',
    ],
    './dist/nrBundle.js',
    function (err) {
        if (err) throw err;
        console.log('build complete');
    }
);
