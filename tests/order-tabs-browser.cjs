// node tests/order-tabs-browser.cjs <theme-path> <puppeteer-module> <chrome-path>
// Actual Horizon Component and order module; isolated mock pagination/cart, no store writes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const [root, puppeteerModule, executablePath] = process.argv.slice(2);
const puppeteer = require(puppeteerModule);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('sections/carpe-collection-order.liquid').match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)[1];
const messages = {loading:'Loading',loadError:'Retry loading',invalid:'Invalid quantity',adding:'Adding',success:'Added',cartError:'Review cart',syncError:'Added; view cart',otherGroup:'Other items',groupError:'Retry tabs'};
let mode = 'success', posts = [], pages = 0, directories = 0, cart = [], errors = [];
function row(id, group) {
  return `<tr data-order-row data-product-id="${id}" data-order-group="${group}"><td>Image</td><td>SKU${id}</td><th scope="row">Dowel ${group} sample-tab</th><td>00123</td><td>$2</td><td><div class="carpe-order__quantity"><button data-delta="-1" on:click="/adjustQuantity">-</button><input data-order-quantity data-variant-id="${id}" data-min="1" data-step="1" type="number" min="0" value="0" on:input="/quantityChanged"><button data-delta="1" on:click="/adjustQuantity">+</button></div></td></tr>`;
}
function markup(second = false, mixed = false) {
  const rows = second ? row(101,'9mm')+row(103,'25mm')+row(104,'9MM')+row(105,'25mm') : row(101,'9mm')+row(102,mixed?'':'12mm');
  return `<carpe-collection-order-component id="CarpeOrder-main" class="carpe-order" data-section-id="main" data-auto-load="false" data-group-index-url="/group-index${mixed?'?mixed=1':''}" data-add-url="/cart/add.js" data-cart-url="/cart.js"><div class="carpe-order__tabs" data-order-tabs role="tablist" aria-label="Sizes" on:click="/selectGroup" on:keydown="/groupKeydown" hidden></div><p data-order-group-status role="status"></p><button data-order-group-retry on:click="/loadGroupIndex" hidden>Retry tabs</button><p data-order-group-empty hidden>No items displayed</p><div class="carpe-order__toolbar"><p>Selected <strong data-order-count>0</strong></p><button data-order-clear on:click="/clearSelection">Clear</button><button data-order-submit on:click="/addSelected" disabled>Add selected</button><p data-order-status role="status"></p></div><div id="Table-main" class="carpe-order__scroll" tabindex="0"><table class="carpe-order__table"><thead><tr><th>Image</th><th>SKU</th><th>Product</th><th>UPC</th><th>Price</th><th>Quantity</th></tr></thead><tbody data-order-rows>${rows}</tbody></table></div><a data-order-next ${second?'hidden':'href="/?page=2"'} on:click="/loadMore">Load more</a><p data-load-status role="status"></p><script type="application/json" data-order-messages>${JSON.stringify(messages)}</script></carpe-collection-order-component>`;
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/group-index') {
    directories++;
    if (mode === 'group-fail') {res.statusCode=500; return res.end('Unavailable');}
    await new Promise(resolve=>setTimeout(resolve,30));
    const groups = url.searchParams.has('page') ? ['25mm'] : ['9mm',url.searchParams.has('mixed')?'':'12mm'];
    return res.end(`<div data-order-group-index>${groups.map(group=>`<span data-index-group="${group}"></span>`).join('')}${url.searchParams.has('page')?'':'<a data-index-next href="/group-index?page=2"></a>'}</div>`);
  }
  if (url.pathname === '/cart/add.js') {
    let body=''; for await (const part of req) body+=part;
    const data=JSON.parse(body); posts.push(data); cart=data.items;
    res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({items:cart}));
  }
  if (url.pathname === '/cart.js') {res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({items:cart,item_count:cart.reduce((sum,item)=>sum+item.quantity,0)}));}
  if (url.searchParams.has('page')) {pages++; if(mode==='page-fail'){res.statusCode=500;return res.end('Unavailable');}return res.end(markup(true));}
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/html');
  if(url.pathname==='/component.js')return res.end(read('assets/component.js'));
  if(url.pathname==='/order.js')return res.end(read('assets/carpe-collection-order.js'));
  if(url.pathname==='/utilities.js')return res.end('export const requestIdleCallback=callback=>window.requestIdleCallback(callback);');
  if(url.pathname==='/renderer.js')return res.end('export const sectionRenderer={async getSectionHTML(id,cache,url,signal){const response=await fetch(url,{signal});if(!response.ok)throw new Error("Failed");return response.text();}};');
  if(url.pathname==='/events.js')return res.end('export const StandardEvents={cartLinesUpdate:"cart:update"};export class CartLinesUpdateEvent extends Event {constructor(data){super("cart:update",{bubbles:true});Object.assign(this,data);}static createPromise(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}static createCartFromAjaxResponse(cart){return cart;}}');
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--color-background:#fff;--color-background-rgb:255 255 255;--color-foreground:#222;--color-foreground-rgb:34 34 34;--color-primary-button-background:#222;--color-primary-button-text:#fff;--color-input-background:#fff;--color-input-text:#222;--color-input-border:#aaa}*{box-sizing:border-box}body{margin:16px;font-family:Arial}${css}</style><script type="importmap">{"imports":{"@theme/component":"/component.js","@theme/utilities":"/utilities.js","@theme/section-renderer":"/renderer.js","@shopify/events":"/events.js"}}</script></head><body>${markup(false,url.searchParams.has('mixed'))}<script type="module" src="/order.js"></script></body></html>`);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await puppeteer.launch({executablePath,headless:true});
  try {
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(String(error)));
    const fresh=async(suffix='',initialMode='success')=>{mode=initialMode;posts=[];cart=[];pages=0;directories=0;await page.goto(origin+suffix);await page.waitForSelector('[data-enhanced]');};
    const tabs=()=>page.$$eval('[data-order-tab]',els=>els.map(el=>el.textContent));
    const visible=()=>page.$$eval('[data-order-row]',els=>els.filter(el=>!el.hidden).map(el=>el.dataset.productId));
    const select=group=>page.click(`[data-order-tab="${group}"]`);
    const setQty=(id,value)=>page.$eval(`[data-variant-id="${id}"]`,(input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
    await fresh();
    await page.waitForFunction(()=>document.querySelectorAll('[data-order-tab]').length===3);
    assert.deepEqual(await tabs(),['9mm','12mm','25mm']);
    assert.equal(directories,2);assert.equal(pages,0);
    assert.deepEqual(await visible(),['101']);
    console.log('PASS numeric tab order and later-page group discovery without loading table rows');
    await setQty(101,2);await select('12mm');await setQty(102,3);
    await select('25mm');await page.waitForSelector('[data-product-id="105"]');
    assert.equal(pages,1);assert.deepEqual(await visible(),['103','105']);
    await setQty(103,1);await select('9mm');
    assert.deepEqual(await visible(),['101','104']);
    assert.equal(await page.$eval('[data-variant-id="101"]',el=>el.value),'2');
    assert.equal(await page.$eval('[data-order-count]',el=>el.textContent),'6');
    await page.click('[data-order-submit]');
    await page.waitForFunction(()=>document.querySelector('[data-order-status]').textContent==='Added');
    assert.deepEqual(posts[0].items,[{id:101,quantity:2},{id:102,quantity:3},{id:103,quantity:1}]);
    assert.equal(posts.length,1);
    console.log('PASS tab switching, case-insensitive groups, preserved selections and single cross-tab cart payload');
    await select('12mm');await setQty(102,-1);await select('9mm');await setQty(101,1);await page.click('[data-order-submit]');
    assert.equal(await page.$eval('[data-order-tab="12mm"]',el=>el.getAttribute('aria-selected')),'true');
    await page.click('[data-order-clear]');
    await page.focus('[data-order-tab="9mm"]');await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderTab),'12mm');
    await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderTab),'25mm');
    await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderTab),'9mm');
    await page.evaluate(()=>document.documentElement.dir='rtl');await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderTab),'12mm');
    console.log('PASS invalid hidden quantity reveals its group; accessible keyboard tabs and RTL');
    await fresh('', 'group-fail');
    await page.waitForFunction(()=>!document.querySelector('[data-order-group-retry]').hidden);
    assert.deepEqual(await tabs(),['9mm','12mm']);
    await setQty(101,2);mode='success';await page.click('[data-order-group-retry]');
    await page.waitForFunction(()=>document.querySelectorAll('[data-order-tab]').length===3);
    assert.equal(await page.$eval('[data-variant-id="101"]',el=>el.value),'2');
    console.log('PASS directory failure and explicit retry without losing quantities');
    mode='page-fail';await select('25mm');
    await page.waitForFunction(()=>document.querySelector('[data-load-status]').textContent==='Retry loading');
    const failedCount=pages;await new Promise(resolve=>setTimeout(resolve,250));assert.equal(pages,failedCount);
    mode='success';await page.click('[data-order-next]');await page.waitForSelector('[data-product-id="105"]');
    assert.deepEqual(await visible(),['103','105']);
    console.log('PASS late-group pagination failure does not loop; retry restores selected group');
    await fresh('/?mixed=1');await page.waitForFunction(()=>[...document.querySelectorAll('[data-order-tab]')].some(el=>el.textContent==='Other items'));
    await select('');assert.deepEqual(await visible(),['102']);
    console.log('PASS ungrouped items remain accessible in Other items');
    await page.setViewport({width:320,height:812});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await page.$eval('.carpe-order__scroll',el=>el.scrollWidth>el.clientWidth));
    await page.evaluate(()=>{const component=document.querySelector('carpe-collection-order-component');component.remove();document.body.prepend(component);});
    await select('9mm');await page.click('[data-product-id="101"] [data-delta="1"]');
    assert.equal(await page.$eval('[data-variant-id="101"]',el=>el.value),'1');
    assert.equal(await page.$$eval('[data-order-tab]',els=>new Set(els.map(el=>el.id)).size),await page.$$eval('[data-order-tab]',els=>els.length));
    console.log('PASS mobile table scroll, no document overflow, reconnect and singular listeners');
    assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
