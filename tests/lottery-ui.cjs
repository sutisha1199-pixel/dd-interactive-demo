const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','lottery.html'),'utf8');
test('lottery page wires core, styles, lobby bridge and manual actions',()=>{assert.match(html,/lottery-core.js/);assert.match(html,/lottery.css/);assert.match(html,/data-action="open-deposit"/);assert.match(html,/data-action="claim-tickets:bet"/);assert.match(html,/data-action="claim-prize/);});
