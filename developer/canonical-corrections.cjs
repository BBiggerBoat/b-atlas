'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
function correction(payload) {
 const key=payload?.CorrectionField;
 const fields=read('data/model-schema.json').groups.flatMap(g=>g.fields||[]);
 const field=fields.find(f=>f.id===key)||fields.find(f=>(f.legacyKeys||[]).includes(key)||(f.legacyMeasurements||[]).some(m=>m.key===key));
 if(!field?.correctable)throw Error('Field is not correctable: '+key);
 let value=payload.ProposedValue;
 if(value===null||value==='unknown')return {field:field.id,value:null};
 if(field.type==='measurement'){
   if(value===''||!Number.isFinite(Number(value)))throw Error('Invalid measurement');
   const unit=payload.ProposedUnit||(field.legacyMeasurements||[]).find(m=>m.key===key)?.unit;
   if(!(field.allowedInputUnits||[field.canonicalUnit]).includes(unit))throw Error('Choose a supported explicit measurement unit');
   const factors={m:1,cm:.01,ft:.3048,in:.0254,kg:1,lb:.45359237,L:1,us_gal:3.785411784,imp_gal:4.54609,kW:1,hp:.745699872,kn:1,nm:1,L_h:1,us_gal_h:3.785411784,imp_gal_h:4.54609};
   if(!factors[unit])throw Error('Unknown unit');
   value=Number(value)*factors[unit];
 } else if(field.type==='integer'||field.type==='number'){
   if(value===''||!Number.isFinite(Number(value)))throw Error('Invalid number');
   value=Number(value);if(field.type==='integer'&&!Number.isInteger(value))throw Error('Integer required');
 } else if(field.type==='boolean'){
   if(value===true||value==='true')value=true;
   else if(value===false||value==='false')value=false;
   else throw Error('Boolean required');
 } else if(field.type==='enum'){
   const messages=read('data/i18n/en.json').messages||{};
   const option=(field.options||[]).find(o=>o.code===value||String(messages[o.labelKey]||'').toLowerCase()===String(value).toLowerCase());
   if(!option)throw Error('Unknown enum value');
   value=option.code;
 } else if(field.type==='array'&&!Array.isArray(value))throw Error('Array required');
 return {field:field.id,value};
}
module.exports={correction};
