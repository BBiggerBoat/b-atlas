'use strict';
// Inspect the proposed tree, including new non-ignored files and staged removals.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const policy=JSON.parse(fs.readFileSync('deployment/repository-size-policy.json','utf8'));
const files=[...new Set(cp.execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{maxBuffer:10000000}).toString().split('\0').filter(Boolean))];
const retired=p=>/^(?:boatmodels\.json|sitemap\.xml|data\/model-permalinks\.json|reports\/(?:canonical-inventory|image-coverage-audit|production-image-availability)\.json)$/.test(p)||/^(?:dist|models|manufacturers|boats|compare|data\/generated|archive\/canonical-migration-baseline)\//.test(p)||/^data\/phase2-live-.*\.json$/.test(p);
const findings=[],exceptions=[],warnings=[];let textFiles=0,largest=0;
for(const file of files){
 if(retired(file))findings.push('Generated/retired output is tracked: '+file);
 if(!fs.existsSync(file)){findings.push('Missing indexed file: '+file);continue;}
 const bytes=fs.readFileSync(file);if(/^images\/.*\.(?:jpe?g|png|gif|webp|ico)$/i.test(file))continue;
 textFiles++;largest=Math.max(largest,bytes.length);
 const exception=policy.exceptions[file];
 if(exception){assert(exception.reason&&exception.maxBytes>policy.maxTextBytes);exceptions.push(file);if(bytes.length>exception.maxBytes)findings.push('Exception ceiling exceeded: '+file);}
 else if(bytes.length>policy.maxTextBytes)findings.push('Text file exceeds '+policy.maxTextBytes+' bytes: '+file+' ('+bytes.length+')');
 else if(bytes.length>policy.warnTextBytes)warnings.push({file,bytes:bytes.length});
}
for(const file of Object.keys(policy.exceptions))if(!files.includes(file))findings.push('Stale size exception: '+file);
const fixtures=require('./historical-fixtures.cjs').verify();
if(findings.length)throw Error(findings.join('\n'));
console.log(JSON.stringify({status:'PASS',files:files.length,textFiles,maxTextBytes:policy.maxTextBytes,largestTextBytes:largest,exceptions,warnings,historicalFixtures:fixtures}));
