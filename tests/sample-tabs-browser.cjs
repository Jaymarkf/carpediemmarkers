// node tests/sample-tabs-browser.cjs <puppeteer-module> <chrome-path> <preview-origin> <sample-state-json> <screenshot-directory>
// Uses an isolated browser cart; adds sample items only, never places an order, clears its cart.
const [puppeteerModule, executablePath, base, stateFile, screenshots] = process.argv.slice(2);
const puppeteer = require(puppeteerModule);
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
fs.mkdirSync(screenshots, {recursive:true});
(async()=>{
  const browser=await puppeteer.launch({executablePath,headless:true});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  let changedCart=false;
  try {
    await page.setViewport({width:1440,height:1000});
    const url=base+'/products/'+state.display.handle+'?preview_theme_id=189153181883';
    const response=await page.goto(url,{waitUntil:'networkidle2',timeout:60000});
    assert.equal(response.status(),200,'Authorized development preview required');
    await page.waitForFunction(()=>document.querySelectorAll('[data-order-tab]').length===3);
    assert.deepEqual(await page.$$eval('[data-order-tab]',els=>els.map(el=>el.textContent)),['9mm','12mm','25mm']);
    assert.equal(await page.$$eval('[data-order-row]',els=>els.length),6);
    assert.equal(await page.$eval('h1',el=>el.textContent.trim()),state.display.title);
    const selected=[];
    for(const group of ['9mm','12mm','25mm']) {
      await page.click(`[data-order-tab="${group}"]`);
      const rows=await page.$$eval('[data-order-row]',els=>els.filter(el=>!el.hidden).map(el=>({id:el.dataset.productId,group:el.dataset.orderGroup,title:el.querySelector('th').textContent.trim()})));
      assert.equal(rows.length,2);
      assert.ok(rows.every(row=>row.group===group && row.title.endsWith('sample-tab')));
      const sample=state.products.find(item=>item.group===group);
      selected.push(sample.variantId.split('/').pop());
      await page.$eval(`[data-product-id="${sample.id.split('/').pop()}"] [data-order-quantity]`,input=>{input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}));});
    }
    await page.click('[data-order-tab="9mm"]');
    assert.equal(await page.$eval('[data-order-count]',el=>el.textContent.trim()),'3');
    await page.$eval('[data-order-tabs]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:path.join(screenshots,'sample-tabs-desktop.png')});
    console.log('PASS three tabs, two correctly named real products per tab, quantities preserved across tabs');
    const initial=await page.evaluate(async()=>(await fetch('/cart.js')).json());
    assert.equal(initial.item_count,0,'Do not modify a nonempty test cart');
    changedCart=true;
    await page.evaluate(async()=>document.querySelector('carpe-collection-order-component').addSelected());
    const cart=await page.evaluate(async()=>(await fetch('/cart.js')).json());
    assert.equal(cart.item_count,3);
    assert.deepEqual(cart.items.map(item=>String(item.variant_id)).sort(),selected.sort());
    assert.ok(cart.items.every(item=>item.quantity===1 && item.product_title.endsWith('sample-tab')));
    assert.ok(!cart.items.some(item=>String(item.variant_id)===state.display.variantId.split('/').pop()));
    console.log('PASS one real cart submission includes only the three selected sample items, not display product');
    await page.evaluate(async()=>{await fetch('/cart/clear.js',{method:'POST',headers:{Accept:'application/json'}});});
    changedCart=false;
    for(const width of [375,320]) {
      await page.setViewport({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok(await page.$eval('.carpe-order__scroll',el=>{el.scrollLeft=200;return el.scrollWidth>el.clientWidth && el.scrollLeft>0;}));
      await page.click('[data-order-tab="25mm"]');
      assert.equal(await page.$$eval('[data-order-row]',els=>els.filter(el=>!el.hidden).length),2);
    }
    await page.$eval('[data-order-tabs]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:path.join(screenshots,'sample-tabs-mobile.png')});
    console.log('PASS phone tabs and horizontal table scroll without document overflow');
    await page.focus('[data-order-tab="25mm"]');await page.keyboard.press('Home');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderTab),'9mm');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderTab),'12mm');
    console.log('PASS keyboard tab navigation');
    for(const [handle,count] of [['olo-premium-markers-brush',34],['copic-sketch-markers',33],['posca-pc-5m-medium',33]]) {
      await page.goto(base+'/products/'+handle,{waitUntil:'networkidle2',timeout:60000});
      await page.waitForSelector('[data-enhanced]');
      await page.evaluate(async()=>{const component=document.querySelector('carpe-collection-order-component');while(component.querySelector('[data-order-next]')?.hasAttribute('href'))await component.loadMore();});
      assert.equal(await page.$$eval('[data-order-row]',els=>els.length),count);
      assert.equal(await page.$eval('[data-order-tabs]',el=>el.hidden),true);
    }
    console.log('PASS all three existing marker tables retain their original row counts and no unwanted tabs');
    const noJs=await browser.newPage();await noJs.setJavaScriptEnabled(false);
    await noJs.goto(url,{waitUntil:'networkidle2',timeout:60000});
    assert.equal(await noJs.$$eval('[data-order-row]',els=>els.filter(el=>getComputedStyle(el).display!=='none').length),6);
    assert.equal(await noJs.$eval('[data-order-tabs]',el=>getComputedStyle(el).display),'none');
    await noJs.close();
    assert.deepEqual(errors,[]);
    console.log('PASS no-JavaScript fallback, no browser exceptions; isolated cart cleared, no order placed');
  }finally{
    if(changedCart)await page.evaluate(async()=>{await fetch('/cart/clear.js',{method:'POST'});}).catch(()=>{});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
