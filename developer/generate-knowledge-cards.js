#!/usr/bin/env node
// Diagnostic export only; no persistent/public duplicate knowledge-card database.
const fs=require('node:fs');
const {load}=require('./canonical-store.cjs');
const {projectCards}=require('../knowledge/knowledgecardui.js');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const cards=projectCards(load(),{resources:read('knowledge/data/curatedresources.json'),listings:read('knowledge/data/listingsearches.json'),annotations:read('knowledge/data/knowledgeannotations.json'),coverage:read('knowledge/data/knowledge-coverage.json')});
if(process.argv.includes('--json')) process.stdout.write(JSON.stringify(cards));
else console.log(`Projected ${cards.length} knowledge cards in memory.`);
