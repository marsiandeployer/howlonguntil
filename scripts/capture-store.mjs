import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const now = Date.parse('2026-10-21T15:45:00Z');
const profile = await mkdtemp(path.join(os.tmpdir(), 'codex-chrome-run-hlu-store-'));
const fixture = await mkdtemp(path.resolve('qa/.extension-fixture-store-'));
const pages = [
 {file:'meeting-1280x800.png',title:'A meeting across time zones.',intro:'The time in the note. The time where you are.',heading:'Team sync',rows:['We meet at <strong id="hover-time">18:00 UTC</strong>.','Bring your questions for the release review.','The recording will be shared after the meeting.']},
 {file:'release-1280x800.png',title:'Know when the release lands.',intro:'Hover the announcement to see your local time and a countdown.',heading:'Release announcement',rows:['The next release goes live on <strong id="hover-time">October 22, 2026 at 18:00 UTC</strong>.','The release notes will be available at launch.','You can keep reading without opening a time converter.']},
];
function html(data){return `<!doctype html><html lang="en"><meta charset="utf-8"><title>How Long Until — example page</title><style>body{margin:0;background:#eaf3fb;color:#142b4b;font:20px/1.6 system-ui,sans-serif}main{width:960px;margin:64px auto}h1{font-size:48px;letter-spacing:-.03em;line-height:1.12;margin:0 0 14px;max-width:880px}header p{margin:0;color:#405876}article{margin-top:38px;background:#fffefa;padding:36px 46px 145px;border-radius:14px}h2{font-size:24px;line-height:1.25;margin:0 0 24px}article p{margin:22px 0}strong{font-weight:600}footer{font-size:14px;color:#405876;margin-top:22px}</style><body><main><header><h1>${data.title}</h1><p>${data.intro}</p></header><article><h2>${data.heading}</h2>${data.rows.map(row=>`<p>${row}</p>`).join('')}</article><footer>How Long Until · Example page · Local time: Europe/Moscow (UTC+3)<br>Example clock: October 21, 2026, 15:45 UTC</footer></main></body></html>`}
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html(pages[req.url==='/release'?1:0]));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 await mkdir('store/screenshots',{recursive:true});
 await cp('dist',fixture,{recursive:true});
 const manifest=JSON.parse(await readFile(path.join(fixture,'manifest.json'),'utf8'));
 manifest.host_permissions=manifest.optional_host_permissions;delete manifest.optional_host_permissions;
 await writeFile(path.join(fixture,'manifest.json'),JSON.stringify(manifest));
 for(const file of ['content.js','popup.js','background.js'])assert.deepEqual(await readFile(path.join(fixture,file)),await readFile(path.join('dist',file)));
 browser=await puppeteer.launch({executablePath:'/snap/bin/chromium',headless:true,pipe:true,enableExtensions:true,userDataDir:profile,defaultViewport:{width:1280,height:800},args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 const id=await browser.installExtension(fixture);
 const target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().includes(id));const worker=await target.worker();
 const controller=await browser.newPage();await controller.goto(`chrome-extension://${id}/popup.html`);
 const page=await browser.newPage();
 for(let i=0;i<pages.length;i++){
  await controller.evaluate(async()=>{await chrome.storage.local.set({settings:{enabled:false,siteDisabled:[],timeZone:'Europe/Moscow',hour12:false,abbreviationOverrides:{}}});await chrome.runtime.sendMessage({type:'HLU_CONFIGURE'});});
  await page.goto(`http://127.0.0.1:${server.address().port}/${i?'release':'meeting'}`,{waitUntil:'networkidle2'});
  const [tab]=await worker.evaluate(async()=>chrome.tabs.query({active:true,lastFocusedWindow:true}));
  await controller.evaluate(async(tabId,clock)=>{await chrome.scripting.executeScript({target:{tabId},func:value=>Date.now=()=>value,args:[clock]});await chrome.storage.local.set({settings:{enabled:true,siteDisabled:[],timeZone:'Europe/Moscow',hour12:false,abbreviationOverrides:{}}});await chrome.runtime.sendMessage({type:'HLU_CONFIGURE'});},tab.id,now);
  await page.waitForFunction(()=>CSS.highlights.get('hlu-event-time')?.size>=1);
  await page.bringToFront();const rect=await page.$eval('#hover-time',el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});await page.mouse.move(rect.x,rect.y);await new Promise(r=>setTimeout(r,350));
  await page.screenshot({path:`store/screenshots/${pages[i].file}`});
  console.log(`Captured real extension: ${pages[i].file}`);
 }
 await writeFile('store/screenshots/README.md','These are actual captures of the bundled extension on labelled example pages, at 1280×800. The example clock is frozen at 2026-10-21 15:45 UTC; target zone Europe/Moscow. A separate capture-only manifest grants hosts up front; runtime JS bytes are asserted identical to the release package. This capture manifest is never shipped.\n');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));for(const dir of[profile,fixture]){await rm(dir,{recursive:true,force:true});await rm('/tmp/snap-private-tmp/snap.chromium'+dir,{recursive:true,force:true});}}
