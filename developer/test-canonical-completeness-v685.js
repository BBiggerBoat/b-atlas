const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const models=JSON.parse(fs.readFileSync(path.join(root,'boatmodels.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(root,'data/canonical-completeness-audit-v6.85.json'),'utf8'));
const queue=JSON.parse(fs.readFileSync(path.join(root,'data/canonical-missing-data-queue-v6.85.json'),'utf8'));
const report=JSON.parse(fs.readFileSync(path.join(root,'data/canonical-normalization-report-v6.85.json'),'utf8'));
function assert(c,m){if(!c){console.error('FAIL:',m);process.exitCode=1;}}
assert(audit.release==='v6.85.0','audit release');
assert(queue.release==='v6.85.0','queue release');
assert(audit.modelCount===models.length && audit.models.length===models.length,'all models audited');
for(const f of audit.fieldSummary){
 const sum=f.present+f.missingResearch+f.researchedUnknown+f.variableByConfiguration+f.notApplicable+f.normalizationGap+f.systemicProgramGap+f.openEndedCurrent;
 assert(sum===models.length,`classification total ${f.field}`);
}
function fsumm(id){return audit.fieldSummary.find(f=>f.field===id);}
assert(fsumm('StyleCode').present===259,'StyleCode complete');
assert(fsumm('FlybridgeCode').present===259,'FlybridgeCode complete');
assert(fsumm('CoolingCode').present===258 && fsumm('CoolingCode').missingResearch===1,'CoolingCode 258 + 1 research');
assert(fsumm('SideDecksCode').present===257 && fsumm('SideDecksCode').normalizationGap===2,'SideDecks 257 + 2 review');
assert(report.changeCount===883,'expected normalization change count');
assert(!queue.normalizationQueue.some(x=>['ShowerTypeCode','KeelConfigurationCode'].includes(x.field)),'unsafe shower/keel not labeled normalization');
for(const r of audit.models){for(const p of ['LOA','Beam','Draft','AirDraft','Headroom','FuelCapacity','WaterCapacity','HoldingCapacity','Displacement']) assert(!(p in r),`audit must not duplicate ${p}`);}
if(!process.exitCode) console.log('PASS canonical completeness v6.85');
