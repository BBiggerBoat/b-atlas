#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const boats=JSON.parse(fs.readFileSync(path.join(ROOT,'boatmodels.json'),'utf8'));
require('../canonicaldata.js');
require('../filterengine.js');
const engine=globalThis.BScoutFilterEngine;
const byId=id=>boats.find(b=>b.BoatModelID===id);
assert(engine,'filter engine must load');

// Canonical dimensions must drive hard filters without legacy mirrors.
const chb=byId('CHBB-34-SE');
assert(chb && chb.Beam && !('Beam_ft' in chb),'CHB canonical beam expected without legacy mirror');
let r=engine.evaluateBoat(chb,{maxBeam:10.5},[],{});
assert.strictEqual(r.passes,false,'CHB 34 Sedan must fail 10.5 ft beam limit from canonical Beam');
assert(r.reasons.includes('max-beam'),'CHB beam rejection reason expected');

const nordic=byId('NDTG-26');
assert(nordic && nordic.LOA && nordic.Beam,'Nordic Tug 26 canonical dimensions expected');
r=engine.evaluateBoat(nordic,{maxLength:32,maxBeam:10.5,fuels:['Diesel'],propulsion:['Shaft']},[],{});
assert.strictEqual(r.passes,true,'Nordic Tug 26 should pass known dimensional/fuel/shaft constraints');

// Unknown data must remain eligible rather than being treated as failure.
const unknownBeam=boats.find(b=>b.Beam==null);
assert(unknownBeam,'at least one unknown-beam model expected');
r=engine.evaluateBoat(unknownBeam,{maxBeam:10.5},[],{});
assert(!r.reasons.includes('max-beam'),'unknown beam must not eliminate a candidate');

// No active model may contain retired measurement mirrors.
const retired=['LOA_ft','LWL_ft','Beam_ft','Draft_ft','AirDraft_ft','Displacement_lb','LengthFt','BeamFt','DraftFt'];
for(const b of boats){for(const k of retired)assert(!Object.prototype.hasOwnProperty.call(b,k),`${b.BoatModelID} contains retired ${k}`);}

console.log('v6.83 canonical field usage and buyer-scenario tests passed');
