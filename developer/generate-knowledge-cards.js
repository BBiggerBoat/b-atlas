#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const write = (rel, value) => fs.writeFileSync(path.join(root, rel), JSON.stringify(value, null, 2) + '\n');
const index = (rows) => new Map(rows.map(row => [String(row.BoatModelID || '').trim(), row]));
const boats = read('boatmodels.json');
const intelligence = index(boats.map(boat => ({ BoatModelID: boat.BoatModelID, intelligence: { overview: boat.Overview || null, suitability: boat.Suitability || {}, strengths: boat.Strengths || [], tradeOffs: boat.TradeOffs || [], bestFor: boat.BestFor || [], avoidIf: boat.AvoidIf || [], knownConcerns: boat.KnownConcerns || [], inspectionFocus: boat.InspectionFocus || [], buyerQuestions: boat.BuyerQuestions || [], ownerActions: boat.OwnerActions || [], modelVariations: boat.ModelVariations || [] }, evidence: boat.EvidenceSummary?.Statements || [], confidence: boat.EvidenceSummary?.EvidenceQuality || 'Unknown', updatedAt: boat.LastUpdated || null, revision: boat.Revision || 1 })));
const resources = index(read('knowledge/data/curatedresources.json'));
const listings = index(read('knowledge/data/listingsearches.json'));
const annotations = index(read('knowledge/data/knowledgeannotations.json'));
const coverage = index(read('knowledge/data/knowledge-coverage.json'));
const cards = boats.map(b=>{
 const id=b.BoatModelID, intel=intelligence.get(id)||{}, res=resources.get(id)||{}, list=listings.get(id)||{}, ann=annotations.get(id)||{}, cov=coverage.get(id)||{};
 const card={schemaVersion:2,generated:true,generatedFrom:['boatmodels.json','curatedresources.json','listingsearches.json','knowledgeannotations.json','knowledge-coverage.json'],identity:{boatModelId:id,manufacturer:b.Manufacturer||'',model:[b.Model,b.Variant].filter(Boolean).join(' '),displayName:b.Nickname||[b.Manufacturer,b.Model,b.Variant].filter(Boolean).join(' ')},intelligence:intel.intelligence||{},evidence:intel.evidence||[],images:b.ImageURL?[{title:`${b.Nickname||id} image`,url:b.ImageURL,sourceLabel:'B-Atlas image library',resourceType:'Model image',verificationStatus:'Local asset'}]:[],videos:res.videos||[],listings:list.listings||[],documents:res.documents||[],ownerCommunities:res.ownerCommunities||[],knownIssues:ann.knownIssues||[],similarModels:ann.similarModels||[],missingInformation:ann.missingInformation||[],sources:[...(res.sources||[]),...(list.sources||[]),...(ann.sources||[])],confidence:intel.confidence||ann.confidence||b.DataConfidence||'Unknown',coverage:cov,updatedAt:[intel.updatedAt,res.updatedAt,list.updatedAt,ann.updatedAt,b.LastUpdated].filter(Boolean).sort().at(-1)||null};
 return card;
});
write('knowledge/data/knowledgecards.json',cards);
console.log(`Generated ${cards.length} knowledge cards.`);
