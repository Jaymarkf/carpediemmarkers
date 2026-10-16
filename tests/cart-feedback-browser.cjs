// node tests/cart-feedback-browser.cjs <theme-path> <puppeteer-module> <chrome-path> <screenshot-directory>
// Uses the actual order module, Horizon Component and fly-to-cart; isolated mock cart, no store writes.
const [root, puppeteerModule, executablePath, screenshots] = process.argv.slice(2);
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const puppeteer = require(puppeteerModule);
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const css = file => read(file).match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)[1];
const styles = css('snippets/fly-to-cart-styles.liquid') + css('sections/carpe-collection-order.liquid');
const messages = {loading:'Loading',loadError:'Retry',invalid:'Invalid',adding:'Adding',success:'Your selected products were added to the cart.',cartError:'Review cart',syncError:'Added; refresh cart'};
let mode='success', posts=[], items=[];
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/cart/add.js') {
    let body='';for await(const chunk of req)body+=chunk;
    const data=JSON.parse(body);posts.push(data);
    await new Promise(resolve=>setTimeout(resolve,160));
    res.setHeader('Content-Type','application/json');
    if(mode==='reject'){res.statusCode=422;return res.end(JSON.stringify({status:422,description:'Sold out'}));}
    items=data.items;return res.end(JSON.stringify({items}));
  }
  if(url.pathname==='/cart.js') {
    res.setHeader('Content-Type','application/json');
    if(mode==='sync-fail'){res.statusCode=500;return res.end('{}');}
    return res.end(JSON.stringify({items,item_count:items.reduce((sum,item)=>sum+item.quantity,0)}));
  }
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/html');
  if(url.pathname==='/component.js')return res.end(read('assets/component.js'));
  if(url.pathname==='/order.js')return res.end(read('assets/carpe-collection-order.js'));
  if(url.pathname==='/fly.js'){if(mode==='module-fail'){res.statusCode=404;return res.end('');}return res.end(read('assets/fly-to-cart.js'));}
  if(url.pathname==='/utilities.js')return res.end('export const requestIdleCallback=callback=>window.requestIdleCallback(callback);export const yieldToMainThread=()=>new Promise(resolve=>setTimeout(resolve,0));');
  if(url.pathname==='/renderer.js')return res.end('export const sectionRenderer={};');
  if(url.pathname==='/events.js')return res.end('export const StandardEvents={cartLinesUpdate:"cart:update"};export class CartLinesUpdateEvent extends Event {constructor(options){super("cart:update",{bubbles:true});Object.assign(this,options);}static createPromise(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}static createCartFromAjaxResponse(cart){return cart;}}');
  res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--color-background:#fff;--color-background-rgb:255 255 255;--color-foreground:#202020;--color-foreground-rgb:32 32 32;--color-foreground-muted:#666;--color-primary-button-background:#173b4b;--color-primary-button-text:#fff;--color-success:#006400;--icon-stroke-width:1.5px;--font-body--family:Arial;--color-input-background:#fff;--color-input-text:#222;--color-input-border:#ccc}*{box-sizing:border-box}body{margin:0;font:16px Arial;background:#f6f5f2}header{position:sticky;top:0;z-index:5;padding:14px 24px;background:white;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}header-actions{display:block}cart-icon{display:grid;place-items:center;width:40px;height:40px}cart-icon svg{width:26px;height:26px}main{margin:70px auto;max-width:900px;padding:0 18px}.carpe-order__toolbar button{border:1px solid #ccc;border-radius:9px;cursor:pointer}[data-order-submit]{background:var(--color-primary-button-background);color:var(--color-primary-button-text)}[data-order-submit]:disabled{opacity:.5}h1{font-size:28px} ${styles}</style><script type="importmap">{"imports":{"@theme/component":"/component.js","@theme/utilities":"/utilities.js","@theme/section-renderer":"/renderer.js","@theme/fly-to-cart":"/fly.js","@shopify/events":"/events.js"}}</script></head><body><header><strong>CARPE DIEM</strong><header-actions><a href="/cart" aria-label="Cart"><cart-icon class="header-actions__cart-icon">${read('assets/icon-cart.svg')}</cart-icon></a></header-actions></header><main><carpe-collection-order-component class="carpe-order" id="CarpeOrder-main" data-section-id="main" data-cart-animation="true" data-auto-load="false" data-add-url="/cart/add.js" data-cart-url="/cart.js"><p class="carpe-order__eyebrow">Quick order</p><h1>Choose your options</h1><div class="carpe-order__toolbar"><p>Units selected: <strong data-order-count>0</strong></p><button data-order-clear on:click="/clearSelection">Clear selection</button><button data-order-submit on:click="/addSelected" disabled>Add selected to cart</button><a href="/cart">View cart</a><p class="carpe-order__status" data-order-status role="status"></p></div><div class="carpe-order__scroll"><table class="carpe-order__table"><thead><tr><th>SKU</th><th>Product</th><th>Price</th><th>Quantity</th></tr></thead><tbody data-order-rows>${[101,102].map(id=>`<tr data-order-row data-product-id="${id}"><td>SKU${id}</td><th scope="row">Sample dowel ${id}</th><td>$2</td><td><div class="carpe-order__quantity"><button data-delta="-1" on:click="/adjustQuantity">-</button><input data-order-quantity data-variant-id="${id}" data-min="1" data-step="1" type="number" min="0" value="0" on:input="/quantityChanged"><button data-delta="1" on:click="/adjustQuantity">+</button></div></td></tr>`).join('')}</tbody></table></div><p data-load-status role="status"></p><template data-order-flight><span class="carpe-order-flight__icon">${read('assets/icon-cart.svg')}</span><span class="carpe-order-flight__count" data-order-flight-count></span></template><template data-order-success-icon><span class="carpe-order__success-icon" aria-hidden="true">${read('assets/icon-checkmark.svg')}</span></template><script type="application/json" data-order-messages>${JSON.stringify(messages)}</script></carpe-collection-order-component></main><script>window.flights=0;window.pulses=0;new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeName==='FLY-TO-CART')window.flights++;}).observe(document.body,{childList:true});const icon=document.querySelector('cart-icon');const original=icon.animate.bind(icon);icon.animate=(...args)=>{window.pulses++;return original(...args);};</script><script type="module" src="/order.js"></script></body></html>`);
});
(async()=>{
  fs.mkdirSync(screenshots,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await puppeteer.launch({executablePath,headless:true});
  const errors=[];
  try {
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(String(error)));
    const fresh=async(value='success')=>{mode=value;posts=[];items=[];await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('[data-enhanced]');};
    const qty=(id,value)=>page.$eval(`[data-variant-id="${id}"]`,(input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
    const added=()=>page.waitForFunction(()=>document.querySelector('[data-order-status]').dataset.success==='true');
    await page.setViewport({width:1280,height:900});await fresh();
    await qty(101,2);await qty(102,3);await page.click('[data-order-submit]');
    assert.equal(await page.evaluate(()=>window.flights),0,'Do not animate before Shopify responds');
    await page.waitForSelector('.fly-to-cart--order');
    assert.equal(await page.$eval('[data-order-flight-count]',el=>el.textContent),'+5');
    assert.equal(await page.$eval('.fly-to-cart--order',el=>el.getAttribute('aria-hidden')),'true');
    await added();
    await new Promise(resolve=>setTimeout(resolve,250));
    await page.screenshot({path:path.join(screenshots,'cart-flight-desktop.png')});
    await page.waitForFunction(()=>window.pulses===1);
    await page.waitForFunction(()=>!document.querySelector('.fly-to-cart--order') && document.querySelector('cart-icon').getAnimations().length===0);
    assert.equal(posts.length,1);assert.equal(await page.evaluate(()=>window.flights),1);
    assert.equal(await page.$eval('[data-order-count]',el=>el.textContent),'0');
    assert.equal(await page.$$eval('.carpe-order__success-icon',els=>els.length),1);
    assert.equal(await page.$eval('[data-order-status]',el=>el.textContent.trim()),messages.success);
    console.log('PASS confirmed success only, +5 batch badge, smooth flight, arrival pulse and cleanup; cart unchanged');
    await fresh('reject');await qty(101,1);await page.click('[data-order-submit]');
    await page.waitForFunction(()=>document.querySelector('[data-order-status]').textContent==='Review cart');
    assert.equal(await page.evaluate(()=>window.flights+window.pulses),0);
    assert.equal(await page.$eval('[data-order-status]',el=>el.dataset.success),'false');
    console.log('PASS rejected add never plays a success effect');
    await fresh();await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await qty(101,1);await page.click('[data-order-submit]');await added();
    assert.equal(await page.evaluate(()=>window.flights+window.pulses),0);
    assert.ok(await page.$('.carpe-order__success-icon'));
    console.log('PASS reduced motion: static checkmark and confirmation, no flight or pulse');
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    await fresh();await page.$eval('carpe-collection-order-component',el=>el.dataset.cartAnimation='false');
    await qty(101,1);await page.click('[data-order-submit]');await added();
    assert.equal(await page.evaluate(()=>window.flights),0);
    console.log('PASS existing theme animation toggle is respected');
    await fresh();await page.$eval('header-actions',el=>el.remove());
    await qty(101,1);await page.click('[data-order-submit]');await added();
    assert.equal(await page.evaluate(()=>window.flights),0);
    console.log('PASS missing/offscreen cart safely falls back to inline confirmation');
    await fresh('module-fail');await qty(101,1);await page.click('[data-order-submit]');await added();
    assert.equal(posts.length,1);assert.equal(await page.$eval('[data-order-status]',el=>el.dataset.success),'true');
    console.log('PASS unavailable animation module cannot turn successful add into an error');
    await fresh('sync-fail');await qty(101,1);await page.click('[data-order-submit]');
    await page.waitForFunction(()=>document.querySelector('[data-order-status]').textContent==='Added; refresh cart');
    await page.waitForSelector('.fly-to-cart--order');
    assert.equal(posts.length,1);
    console.log('PASS confirmed POST still gives visual feedback if follow-up cart refresh fails; no duplicate POST');
    await fresh();await qty(101,1);
    await page.evaluate(()=>{const component=document.querySelector('carpe-collection-order-component');component.addSelected();component.addSelected();});
    await page.waitForSelector('.fly-to-cart--order');
    await page.$eval('carpe-collection-order-component',el=>el.remove());
    assert.equal(await page.$('.fly-to-cart--order'),null);assert.equal(posts.length,1);
    console.log('PASS component disconnect cancels overlays; double submission stays guarded');
    await page.setViewport({width:375,height:812});await fresh();await qty(101,1);await page.click('[data-order-submit]');
    await page.waitForSelector('.fly-to-cart--order');await added();
    await new Promise(resolve=>setTimeout(resolve,220));
    await page.screenshot({path:path.join(screenshots,'cart-flight-mobile.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.setViewport({width:390,height:812});
    await page.waitForFunction(()=>!document.querySelector('.fly-to-cart--order'));
    console.log('PASS mobile flight has no page overflow; resize cancels stale flight geometry');
    assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
