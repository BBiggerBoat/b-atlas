const fs=require("fs");
const path=require("path");

const file=process.argv[2];
const out=process.argv[3]||"B-Atlas_D1_Restore.sql";
if(!file){
  console.error("Usage: node developer/backup-to-d1-sql.js <B-Atlas_Backup.json> [output.sql]");
  process.exit(2);
}
const backup=JSON.parse(fs.readFileSync(path.resolve(file),"utf8"));
if(backup?.schema!=="batlas-backup-v1") throw new Error("Unsupported backup schema");

const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
const rows={
  pending:backup.snapshot?.pending||[],
  reviewed:backup.snapshot?.reviewed||[],
  knowledgeItems:backup.snapshot?.knowledgeItems||[],
  knowledgeEvidence:backup.snapshot?.knowledgeEvidence||[],
  resourceReview:backup.snapshot?.resourceReview||[],
  published:backup.published||{}
};
const stamp=backup.exportedAt||new Date().toISOString();
let sql="-- B-Atlas D1 restore generated from authenticated backup\n";
sql+="-- Review target database before execution. This replaces B-Atlas state rows only.\n";
sql+="BEGIN TRANSACTION;\n";
sql+="CREATE TABLE IF NOT EXISTS bscout_state (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);\n";
for(const [key,value] of Object.entries(rows)){
  sql+=`INSERT INTO bscout_state (key,json,updated_at) VALUES (${quote(key)},${quote(JSON.stringify(value))},${quote(stamp)}) ON CONFLICT(key) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at;\n`;
}
sql+="COMMIT;\n";
fs.writeFileSync(path.resolve(out),sql);
console.log(`Wrote ${out}`);
console.log("This SQL restores D1 JSON state only. KV attachment binaries require separate recovery.");
