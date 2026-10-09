const {spawn}=require('child_process');const fs=require('fs');const assert=require('assert');
const chrome=spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--remote-debugging-pipe','--user-data-dir=/private/tmp/second-fish-test-profile'],{stdio:['ignore','ignore',fs.openSync('/private/tmp/second-fish-chrome.log','w'),'pipe','pipe']});
let seq=0,buf='',pending=new Map(),session,errors=[];
chrome.stdio[4].on('data',chunk=>{buf+=chunk;let i;while((i=buf.indexOf('\0'))>=0){const raw=buf.slice(0,i);buf=buf.slice(i+1);if(!raw)continue;const msg=JSON.parse(raw);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p?.reject(Error(JSON.stringify(msg.error))):p?.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);}});
function send(method,params={},browser=false){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(!browser&&session?{sessionId:session}:{})})+'\0');});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(expression,timeout=15000){const until=Date.now()+timeout;while(Date.now()<until){if(await ev(expression))return;await delay(100);}throw Error('Timeout: '+expression+'\n'+await ev('document.body.innerText'));}
async function snap(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/private/tmp/second-fish-'+name+'.png',Buffer.from(r.data,'base64'));}
async function click(selector){await ev(`document.querySelector(${JSON.stringify(selector)})?.click()`);}
(async()=>{try {
 const t=await send('Target.createTarget',{url:'about:blank'},true);
 session=(await send('Target.attachToTarget',{targetId:t.targetId,flatten:true},true)).sessionId;
 await send('Page.enable'); await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8765/'});
 await wait('fishElements.length === 10',30000);
 assert.equal(await ev('Promise.all(Object.values(GAME_ASSETS).map(loadImage)).then(r=>r.every(Boolean))'),true);
 assert.equal(await ev('document.querySelectorAll(".fish").length'),10);
 await snap('desktop');
 for (const [width,height] of [[1280,720],[640,360],[960,540],[320,180],[800,600],[360,640]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await delay(100);
  const r=await ev(`(()=>{const r=stage.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,ratio:r.width/r.height,scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,bg:getComputedStyle(document.body).backgroundColor}})()`);
  assert(r.left>=-1&&r.top>=-1&&r.right<=width+1&&r.bottom<=height+1,JSON.stringify(r));
  assert(Math.abs(r.ratio-16/9)<0.001); assert(!r.scroll); assert.equal(r.bg,'rgba(0, 0, 0, 0)');
 }
 console.log('PASS: six proportional transparent layouts without scrolling or stage clipping.');
 await send('Emulation.setDeviceMetricsOverride',{width:640,height:360,deviceScaleFactor:1,mobile:false});
 // Dispatch a real scaled mouse click and check the puzzle association.
 const pos=await ev('(()=>{const r=fishElements[0].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});
 await wait('puzzleReady'); assert.equal(await ev('wordImages[currentWord] === document.querySelector(".word-image").getAttribute("src")'),true);
 await snap('embedded-puzzle');
 await ev('document.getElementById("word-input").value=currentWord;checkWord();checkWord()');
 await wait('!isModalOpen'); assert.equal(await ev('fishRemaining'),9);
 // Three wrong answers remove exactly one fish and show the original answer.
 const wrongIndex=await ev('fishElements.findIndex(f=>f.style.display!=="none")');
 await ev(`fishElements[${wrongIndex}].click()`); await wait('puzzleReady');
 for(let i=0;i<3;i++)await ev('document.getElementById("word-input").value="wrong";checkWord()');
 assert.equal(await ev('attempts'),3); assert.equal(await ev('document.querySelector(".correct-word").textContent'),await ev('currentWord'));
 await ev('checkWord()'); assert.equal(await ev('attempts'),3); await wait('!isModalOpen'); assert.equal(await ev('fishRemaining'),8);
 for(let i=0;i<10;i++)if(await ev(`fishElements[${i}].style.display!=="none"`)) {
  await ev(`fishElements[${i}].click()`); await wait('puzzleReady');
  await ev('document.getElementById("word-input").value=currentWord;checkWord()');await wait('!isModalOpen');
 }
 await wait('!!document.querySelector(".final-text")');assert.equal(await ev('fishRemaining'),0);
 assert.equal(await ev('masterGain.gain.value'),Math.fround(0.2)); await delay(500);
 assert(await ev('document.querySelectorAll(".firework").length>0')); await snap('victory');
 console.log('PASS: scaled mouse input, correct answers, three wrong attempts, repeat-submit guard, all ten fish, victory and 20% master gain.');
 // Actual iframe: preserve the parent's visible color through transparent game pixels.
 await ev(`document.open();document.write('<body style="margin:0;background:#765432"><iframe src="/" style="width:640px;height:360px;border:0"></iframe></body>');document.close()`);
 await wait('document.querySelector("iframe")?.contentWindow.eval("typeof fishElements !== `undefined` && fishElements.length === 10")');
 assert.equal(await ev('getComputedStyle(document.querySelector("iframe").contentDocument.body).backgroundColor'),'rgba(0, 0, 0, 0)');await snap('iframe');
 console.log('PASS: actual local 640×360 iframe.');
 // Reload, block one puzzle request, and verify it releases without consuming attempts.
 await send('Page.navigate',{url:'http://127.0.0.1:8765/'});await wait('fishElements.length===10');
 await ev('imageLoads.clear();wordImages[words[0]]="assets/intentional-missing.webp";fishElements[0].click()');
 await wait('!isModalOpen',15000); assert.equal(await ev('fishRemaining'),10);assert.equal(await ev('attempts'),0);
 await ev('wordImages[words[0]]=GAME_ASSETS["ancient-man"];fishElements[0].click()');await wait('puzzleReady');
 // Real touch at scaled coordinates, after closing the current puzzle.
 await ev('closeModal(false)');
 const touchPos=await ev('(()=>{const r=fishElements[1].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await send('Emulation.setTouchEmulationEnabled',{enabled:true});
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPos]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait('puzzleReady');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('PASS: failed puzzle recovery, real touch input, no JavaScript exceptions. ALL BROWSER TESTS PASS.');
} catch(e){console.error('FAIL:',e.stack);process.exitCode=1;} finally {await send('Browser.close',{},true).catch(()=>{});}})();
