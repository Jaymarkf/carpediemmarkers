// Run with: node tests/product-ranges-browser.cjs <puppeteer-module> <chrome-path> <preview-origin> <setup-state-json> <screenshot-directory>
const [puppeteerModule, executablePath, base, stateFile, screenshotDir] = process.argv.slice(2);
const puppeteer=require(puppeteerModule);
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
fs.mkdirSync(screenshotDir,{recursive:true});
(async()=>{
  const browser=await puppeteer.launch({executablePath,headless:true});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  let cleanCart=false;
  try {
    await page.setViewport({width:1440,height:1000});
    await page.goto(base+'/collections/see-all-manufacturers',{waitUntil:'networkidle2',timeout:60000});
    assert.equal(await page.$$eval('.carpe-range-card',cards=>cards.length),3);
    console.log('PASS manufacturers collection displays three real product-range cards');
    const menu=await page.$$eval('.mega-menu__link',links=>links.map(link=>({href:link.getAttribute('href'),label:link.textContent.trim()})));
    for(const range of state.ranges){
      assert.ok(menu.some(link=>link.href==='/collections/'+range.brandHandle),'Missing brand menu link '+range.brandHandle);
      assert.ok(menu.some(link=>link.href==='/products/'+range.productHandle),'Missing product menu link '+range.productHandle);
    }
    console.log('PASS desktop menu has brand collection links and real product destinations');
    await page.hover('header-menu a[href="/collections/see-all-manufacturers"]');
    await page.waitForSelector('header-menu .menu-list__submenu:not([inert])',{visible:true});
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,600)));
    await page.screenshot({path:path.join(screenshotDir,'navigation-desktop.png'),fullPage:false});
    await page.keyboard.press('Escape');
    console.log('PASS desktop mega menu opens and its nested links are accessible');
    for(const range of state.ranges){
      const response=await page.goto(base+'/collections/'+range.brandHandle,{waitUntil:'networkidle2',timeout:60000});
      try {await page.waitForSelector('.carpe-range-card',{timeout:15000});}
      catch(error){console.log('FAILED_COLLECTION',JSON.stringify({status:response.status(),url:page.url(),body:await page.evaluate(()=>document.body.innerText.slice(0,4000)),errors}));throw error;}
      assert.equal(await page.$$eval('.carpe-range-card',cards=>cards.length),1);
      assert.equal(await page.$eval('.carpe-range-card',card=>card.getAttribute('href')),'/products/'+range.productHandle);
      await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:60000}),page.click('.carpe-range-card')]);
      assert.equal(new URL(page.url()).pathname,'/products/'+range.productHandle);
      assert.equal(new URL(page.url()).search,'');
      await page.waitForSelector('[data-enhanced]');
      assert.equal(await page.$eval('h1',heading=>heading.textContent.trim()),range.title);
      assert.equal(await page.$$eval('[data-order-row]',rows=>rows.length),24);
      const first=await page.$eval('[data-order-quantity]',input=>{input.value='2';input.dispatchEvent(new Event('input',{bubbles:true}));return input.dataset.variantId;});
      await page.evaluate(async()=>document.querySelector('carpe-collection-order-component').loadMore());
      await page.waitForFunction(count=>document.querySelectorAll('[data-order-row]').length===count,{},range.count);
      assert.equal(await page.$eval(`[data-variant-id="${first}"]`,input=>input.value),'2');
      assert.equal(await page.$$eval('[data-order-row]',rows=>new Set(rows.map(row=>row.dataset.productId)).size),range.count);
      assert.equal(await page.$(`input[name="id"][value="${range.displayVariantId.split('/').pop()}"]`),null);
      console.log(`PASS ${range.brandHandle}: brand card -> clean product URL -> ${range.count} unique color rows; quantities preserved`);
      if(range.key==='olo-brush'){
        const cartBefore=await page.evaluate(async()=>(await fetch('/cart.js')).json());
        assert.equal(cartBefore.item_count,0);cleanCart=true;
        const second=await page.$$eval('[data-order-quantity]',inputs=>{const input=inputs[30];input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));return input.dataset.variantId;});
        await page.evaluate(async()=>document.querySelector('carpe-collection-order-component').addSelected());
        const cart=await page.evaluate(async()=>(await fetch('/cart.js')).json());
        assert.equal(cart.item_count,5);
        assert.equal(cart.items.find(item=>String(item.variant_id)===first)?.quantity,2);
        assert.equal(cart.items.find(item=>String(item.variant_id)===second)?.quantity,3);
        assert.ok(!cart.items.some(item=>String(item.variant_id)===range.displayVariantId.split('/').pop()));
        assert.equal(await page.$eval('[data-order-count]',el=>el.textContent),'0');
        console.log('PASS real cart adds only original OLO color variants, never the range display product');
        await page.screenshot({path:path.join(screenshotDir,'product-range-desktop.png'),fullPage:false});
      }
    }
    await page.setViewport({width:375,height:812});
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await page.$eval('.carpe-order__scroll',el=>{el.scrollLeft=el.scrollWidth;return el.scrollLeft>0;}));
    await page.screenshot({path:path.join(screenshotDir,'product-range-mobile.png'),fullPage:false});
    console.log('PASS mobile product table horizontal scrolling without page overflow');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.evaluate(()=>customElements.whenDefined('header-drawer'));
    await page.locator('.header__drawer summary.header__icon--menu').click();
    await page.waitForSelector('.header__drawer #Details-menu-drawer-container[open]');
    // Wait for the drawer and its staggered menu items to finish entering before
    // tapping a submenu; visibility alone also matches mid-animation elements.
    await page.waitForFunction(()=>{
      const drawer=document.querySelector('.header__drawer .menu-drawer');
      return drawer && drawer.getBoundingClientRect().left >= -1 &&
        !drawer.getAnimations({subtree:true}).some(animation=>animation.playState==='running');
    });
    await page.locator('.header__drawer #HeaderDrawer-see-all-manufacturers').click();
    try {await page.waitForSelector('.header__drawer a[href="/products/olo-premium-markers-brush"]',{visible:true});}
    catch(error){
      await page.screenshot({path:path.join(screenshotDir,'failed-mobile-menu.png'),fullPage:false});
      console.log('FAILED_MOBILE_MENU',await page.evaluate(()=>({url:location.href,details:[...document.querySelectorAll('header-drawer details')].map(el=>({id:el.id,open:el.open,classes:el.className})),text:document.querySelector('header-drawer')?.innerText})));
      throw error;
    }
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,600)));
    await page.screenshot({path:path.join(screenshotDir,'navigation-mobile.png'),fullPage:false});
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2',timeout:60000}),page.locator('.header__drawer a[href="/products/olo-premium-markers-brush"]').click()]);
    assert.equal(new URL(page.url()).pathname,'/products/olo-premium-markers-brush');
    await page.waitForSelector('[data-enhanced]');
    console.log('PASS mobile menu opens the real OLO product page');
    const individual=await page.$eval('.carpe-order__product a',el=>el.href);
    await page.goto(individual,{waitUntil:'networkidle2',timeout:60000});
    assert.equal(await page.$('carpe-collection-order-component'),null);
    assert.ok(await page.$('product-form-component'));
    console.log('PASS existing individual product page retains its original purchasing form');
    // Run the deliberately invalid cart request last: Shopify's local development
    // proxy can invalidate its password-bypass preview cookie on rejected POSTs.
    const displayVariant=state.ranges.find(range=>range.key==='olo-brush').displayVariantId.split('/').pop();
    const attempt=await page.evaluate(async(id)=>{const response=await fetch('/cart/add.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{id:Number(id),quantity:1}]})});return {status:response.status,body:await response.json()};},displayVariant);
    assert.equal(attempt.status,422);
    assert.equal((await page.evaluate(async()=>(await fetch('/cart.js')).json())).item_count,5);
    console.log('PASS Shopify rejects direct purchase of the display variant');
    assert.deepEqual(errors,[]);
    console.log('PASS no browser exceptions');
  } finally {
    if(cleanCart){await page.evaluate(async()=>fetch('/cart/clear.js',{method:'POST'}));console.log('Isolated test cart cleared; no order created.');}
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
