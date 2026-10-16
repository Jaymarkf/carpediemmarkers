// node tests/cart-presence-browser.cjs <theme-path> <puppeteer-module> <chrome-path> <screenshot-directory>
// Actual feature module and Horizon Component with isolated cart/pagination fixtures.
const [root,puppeteerModule,executablePath,screenshots]=process.argv.slice(2);
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const puppeteer=require(puppeteerModule);
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const styles=read('sections/carpe-collection-order.liquid').match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)[1];
let cart=[],gets=0,posts=[],fail=false,hold=false,held=[];
const messages={loading:'Loading',loadError:'Retry',invalid:'Invalid',adding:'Adding',success:'Added',cartError:'Review cart',syncError:'Refresh cart',inCartQuantity:'Already in your cart: __count__'};
const badge=(variant,product='',count=0)=>`<span class="carpe-order__cart-presence" data-order-in-cart ${product?`data-cart-product-id="${product}"`:`data-cart-variant-id="${variant}"`} ${count?'':'hidden'}><span class="carpe-order__cart-presence-visual" aria-hidden="true">${read('assets/icon-cart.svg')}<span>In cart</span><span>&middot;</span><bdi data-order-cart-count>${count}</bdi></span><span class="visually-hidden" data-order-cart-label>Already in your cart: ${count}</span></span>`;
function row(id,product=false){return `<tr data-order-row data-product-id="${id}"><td>Image</td><td>SKU${id}</td><th scope="row">Birch dowel ${id}</th><td>$2</td><td><div class="carpe-order__quantity"><button data-delta="-1" on:click="/adjustQuantity">-</button><input data-order-quantity data-variant-id="${id}" data-min="1" data-step="1" type="number" min="0" value="0" on:input="/quantityChanged"><button data-delta="1" on:click="/adjustQuantity">+</button></div>${badge(id,product?'900':'')}</td></tr>`;}
function markup(second=false){return `<carpe-collection-order-component class="carpe-order" id="CarpeOrder-main" data-section-id="main" data-auto-load="false" data-add-url="/cart/add.js" data-cart-url="/cart.js"><h1>Choose your options</h1><div class="carpe-order__toolbar"><p>Units selected <strong data-order-count>0</strong></p><button data-order-clear on:click="/clearSelection">Clear</button><button data-order-submit on:click="/addSelected" disabled>Add selected</button><p data-order-status role="status"></p></div><div class="carpe-order__scroll"><table class="carpe-order__table"><thead><tr><th>Image</th><th>SKU</th><th>Product</th><th>Price</th><th>Quantity</th></tr></thead><tbody data-order-rows>${second?row(103)+row(104,true):row(101)+row(102)}</tbody></table></div><a data-order-next ${second?'hidden':'href="/?page=2"'} on:click="/loadMore">Load more</a><p data-load-status role="status"></p><script type="application/json" data-order-messages>${JSON.stringify(messages)}</script></carpe-collection-order-component>`;}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/cart.js'){
  gets++;const snapshot=JSON.stringify({items:cart,item_count:cart.reduce((sum,item)=>sum+item.quantity,0)});
  if(hold){held.push(()=>{res.setHeader('Content-Type','application/json');res.end(snapshot);});return;}
  res.setHeader('Content-Type','application/json');if(fail){res.statusCode=500;return res.end('{}');}return res.end(snapshot);
 }
 if(url.pathname==='/cart/add.js'){
  let body='';for await(const part of req)body+=part;const data=JSON.parse(body);posts.push(data);
  for(const item of data.items){const existing=cart.find(line=>line.variant_id===item.id);if(existing)existing.quantity+=item.quantity;else cart.push({variant_id:item.id,product_id:item.id,quantity:item.quantity});}
  res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({items:data.items}));
 }
 if(url.searchParams.has('page'))return res.end(markup(true));
 res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/html');
 if(url.pathname==='/component.js')return res.end(read('assets/component.js'));
 if(url.pathname==='/order.js')return res.end(read('assets/carpe-collection-order.js'));
 if(url.pathname==='/utilities.js')return res.end('export const requestIdleCallback=callback=>window.requestIdleCallback(callback);');
 if(url.pathname==='/renderer.js')return res.end('export const sectionRenderer={async getSectionHTML(id,cache,url,signal){return (await fetch(url,{signal})).text();}};');
 if(url.pathname==='/events.js')return res.end('export const StandardEvents={cartLinesUpdate:"cart:update"};export class CartLinesUpdateEvent extends Event{constructor(data){super("cart:update",{bubbles:true});Object.assign(this,data);}static createPromise(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}static createCartFromAjaxResponse(cart){return {totalQuantity:cart.item_count};}}');
 res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--color-background:#fff;--color-background-rgb:255 255 255;--color-foreground:#222;--color-foreground-rgb:34 34 34;--color-success:#006400;--color-input-border:#ccc;--color-input-background:#fff;--color-input-text:#222;--color-primary-button-background:#173b4b;--color-primary-button-text:#fff;--icon-stroke-width:1.5px}*{box-sizing:border-box}body{margin:24px;font:16px Arial}h1{font-size:28px}.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap} ${styles}</style><script type="importmap">{"imports":{"@theme/component":"/component.js","@theme/utilities":"/utilities.js","@theme/section-renderer":"/renderer.js","@shopify/events":"/events.js"}}</script></head><body>${markup()}<script type="module" src="/order.js"></script></body></html>`);
});
(async()=>{
 fs.mkdirSync(screenshots,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await puppeteer.launch({executablePath,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const fresh=async(items=[])=>{cart=items;gets=0;posts=[];fail=false;hold=false;await page.goto(origin);await page.waitForSelector('[data-enhanced]');};
  const count=id=>page.$eval(`[data-cart-variant-id="${id}"]`,el=>({hidden:el.hidden,count:el.querySelector('[data-order-cart-count]').textContent}));
  const waitCount=(id,n)=>page.waitForFunction((id,n)=>{const badge=document.querySelector(`[data-cart-variant-id="${id}"]`);return badge&&!badge.hidden&&Number(badge.querySelector('[data-order-cart-count]').textContent)===n;},{},id,n);
  const qty=(id,value)=>page.$eval(`[data-variant-id="${id}"]`,(input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const notify=async(items,total=items.reduce((sum,item)=>sum+item.quantity,0))=>page.evaluate(({items,total})=>{const event=new Event('cart:update',{bubbles:true});event.promise=Promise.resolve({cart:{totalQuantity:total},detail:{items}});document.dispatchEvent(event);},{items,total});
  await fresh([{variant_id:101,product_id:101,quantity:1},{variant_id:101,product_id:101,quantity:2}]);
  await waitCount(101,3);assert.equal((await count(102)).hidden,true);
  assert.equal(await page.$eval('[data-variant-id="101"]',el=>el.value),'0');assert.equal(gets,1);
  console.log('PASS initial cart reconciliation aggregates split variant lines; inputs stay zero; one request for whole table');
  await qty(102,2);await notify([{variant_id:101,product_id:101,quantity:5}]);await waitCount(101,5);
  assert.equal(await page.$eval('[data-variant-id="102"]',el=>el.value),'2');assert.equal(gets,1);
  await notify([]);await page.waitForFunction(()=>document.querySelector('[data-cart-variant-id="101"]').hidden);
  console.log('PASS drawer/product/cart events update/remove badges without changing input selections or extra requests');
  cart=[{variant_id:101,product_id:101,quantity:3},{variant_id:103,product_id:103,quantity:4},{variant_id:201,product_id:900,quantity:2},{variant_id:202,product_id:900,quantity:3}];
  await notify(cart);await waitCount(101,3);
  await page.click('[data-order-next]');await page.waitForSelector('[data-product-id="104"]');await waitCount(103,4);
  assert.equal(await page.$eval('[data-cart-product-id="900"] [data-order-cart-count]',el=>el.textContent),'5');
  console.log('PASS newly appended rows inherit current cart badges; multi-variant product rows aggregate product totals');
  await page.$eval('[data-order-clear]',el=>el.click());await qty(101,2);await page.click('[data-order-submit]');
  await waitCount(101,5);assert.equal(await page.$eval('[data-variant-id="101"]',el=>el.value),'0');assert.equal(posts.length,1);
  console.log('PASS add-selected increments cart badge while clearing only new-selection inputs');
  const afterAddGets=gets;await page.reload();await page.waitForSelector('[data-enhanced]');await waitCount(101,5);
  assert.equal(await page.$eval('[data-variant-id="101"]',el=>el.value),'0');assert.equal(gets,afterAddGets+1);
  cart=[{variant_id:101,product_id:101,quantity:7}];await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await waitCount(101,7);
  cart=[{variant_id:101,product_id:101,quantity:8}];const resumeGets=gets;
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await waitCount(101,8);assert.equal(gets,resumeGets+1);
  console.log('PASS revisit/reload, back-forward cache restore and coalesced focus/visibility refresh');
  fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await new Promise(resolve=>setTimeout(resolve,180));
  assert.equal((await count(101)).count,'8');const failedGets=gets;await new Promise(resolve=>setTimeout(resolve,200));assert.equal(gets,failedGets);
  fail=false;
  console.log('PASS network failure keeps last confirmed badge, does not show a false zero or loop');
  await fresh([{variant_id:101,product_id:101,quantity:1}]);await waitCount(101,1);
  hold=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await new Promise(resolve=>setTimeout(resolve,160));assert.equal(held.length,1);
  await notify([{variant_id:101,product_id:101,quantity:9}]);await waitCount(101,9);hold=false;held.splice(0).forEach(resolve=>resolve());await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal((await count(101)).count,'9');
  console.log('PASS slow stale GET cannot overwrite a newer settled cart update');
  cart=[{variant_id:101,product_id:101,quantity:10}];await notify([{variant_id:101,product_id:101,quantity:2}],10);await waitCount(101,10);
  console.log('PASS partial add-result payload is not mistaken for the full cart');
  await page.setViewport({width:375,height:812});await page.screenshot({path:path.join(screenshots,'cart-badge-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const badgeRect=await page.$eval('[data-cart-variant-id="101"]',el=>el.getBoundingClientRect().toJSON());assert.ok(badgeRect.left>=0&&badgeRect.right<=375);
  await page.setViewport({width:1280,height:900});await page.screenshot({path:path.join(screenshots,'cart-badge-desktop.png')});
  await page.evaluate(()=>document.documentElement.dir='rtl');await page.setViewport({width:320,height:812});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{const component=document.querySelector('carpe-collection-order-component');component.remove();document.body.prepend(component);});await waitCount(101,10);
  const beforeEventGets=gets;await notify([{variant_id:101,product_id:101,quantity:12}]);await waitCount(101,12);assert.equal(gets,beforeEventGets);
  assert.deepEqual(errors,[]);console.log('PASS responsive sticky-column badge, RTL, reconnect without duplicate listeners and no browser exceptions');
 }finally{held.splice(0).forEach(resolve=>resolve());await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
