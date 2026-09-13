const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const models = JSON.parse(fs.readFileSync(path.join(root,'boatmodels.json'),'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root,'data/canonical-completeness-audit-v6.84.json'),'utf8'));
const queue = JSON.parse(fs.readFileSync(path.join(root,'data/canonical-missing-data-queue-v6.84.json'),'utf8'));
function assert(cond,msg){ if(!cond){ console.error('FAIL:',msg); process.exitCode=1; } }
assert(audit.release==='v6.84.0','audit release');
assert(queue.release==='v6.84.0','queue release');
assert(audit.modelCount===models.length,'model count matches');
assert(audit.models.length===models.length,'all models audited');
assert(audit.registeredFieldCount===80,'expected registry field count');
for(const f of audit.fieldSummary){
  const sum = f.present+f.missingResearch+f.researchedUnknown+f.variableByConfiguration+f.notApplicable+f.normalizationGap+f.systemicProgramGap+f.openEndedCurrent;
  assert(sum===models.length,`classification total for ${f.field}: ${sum}`);
}
for(const r of audit.models){
  // The audit may identify fields and statuses, but it must not copy canonical specification values.
  for(const prohibited of ['LOA','Beam','Draft','AirDraft','Headroom','FuelCapacity','WaterCapacity','HoldingCapacity','Displacement']){
    assert(!(prohibited in r),`audit must not duplicate ${prohibited} values`);
  }
}
const loa = audit.fieldSummary.find(f=>f.field==='LOA');
const beam = audit.fieldSummary.find(f=>f.field==='Beam');
const draft = audit.fieldSummary.find(f=>f.field==='Draft');
assert(loa && loa.missingResearch===0 && loa.researchedUnknown===7,'LOA researched-unknown classification');
assert(beam && beam.missingResearch===0 && beam.researchedUnknown===7,'Beam researched-unknown classification');
assert(draft && draft.missingResearch===0 && draft.researchedUnknown===9,'Draft researched-unknown classification');
if(!process.exitCode) console.log('PASS canonical completeness v6.84');
