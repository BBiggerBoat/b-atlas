'use strict';
// Historical snapshots remain immutable. Additions have a separate explicit allowlist
// and semantic integration test; comparison must still cover every historical field.
const assert=require('node:assert/strict');
const additionIDs=['PRES-41-DC','PRES-42-TR','OCAL-42-SE','DEFE-44-OC','MRTR-40-SU','CHBY-38-DC','KHAS-40-SU'];
const historicalCount=995,modelCount=historicalCount+additionIDs.length;
function assertHistorical(current,baseline,message='Historical catalogue changed'){
 assert.equal(baseline.length,historicalCount);
 assert.equal(current.length,modelCount);
 assert.deepEqual(current.slice(0,historicalCount),baseline,message);
 assert.deepEqual(current.slice(historicalCount).map(m=>m.BoatModelID),additionIDs,'Unexpected catalogue additions/order');
 assert.equal(new Set(current.map(m=>m.BoatModelID)).size,modelCount);
}
module.exports={additionIDs,historicalCount,modelCount,assertHistorical};
