/* Run with Node: collection-order-browser.cjs <theme-path> <puppeteer-module-path> <chrome-path>
 * Uses installed browser tooling, without adding dependencies to the storefront.
 * Tests actual feature JS and Horizon Component against controlled cart/pagination fixtures.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const [root, puppeteerPath, executablePath] = process.argv.slice(2);
const puppeteer = require(puppeteerPath);
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const css = read('sections/carpe-collection-order.liquid').match(/{% stylesheet %}([\s\S]*?){% endstylesheet %}/)[1];
const messages = { loading: 'Loading', loadError: 'Retry loading', invalid: 'Invalid quantity', adding: 'Adding', success: 'Added', cartError: 'Review cart before retry', syncError: 'Added; view cart' };
const row = (id, min = 1, step = 1, max = '') => `<tr data-order-row data-product-id="${id}"><td>Image</td><td>SKU${id}</td><th scope="row">Marker ${id}</th><td>0012345</td><td>$3.50</td><td><div class="carpe-order__quantity carpe-order__enhanced"><button data-delta="-1" on:click="/adjustQuantity">−</button><input data-order-quantity data-variant-id="${id}" data-min="${min}" data-step="${step}" type="number" min="0" step="1" max="${max}" value="0" on:input="/quantityChanged"><button data-delta="1" on:click="/adjustQuantity">+</button></div><a class="carpe-order__fallback" href="/product">View product</a></td></tr>`;
const markup = (page = 1, auto = false) => `<carpe-collection-order-component class="carpe-order" id="CarpeOrder-main" data-section-id="main" data-auto-load="${auto}" data-add-url="/cart/add.js" data-cart-url="/cart.js"><header><h1>Quick Shop: Copic Sketch</h1><p>Select quantities for your next project.</p></header><div class="carpe-order__scroll" tabindex="0"><table class="carpe-order__table"><thead><tr><th>Image</th><th>SKU</th><th>Product</th><th>UPC</th><th>Price</th><th>Quantity</th></tr></thead><tbody data-order-rows>${page === 1 ? row(101) + row(102, 4, 2, 10) : row(101) + row(103)}</tbody></table></div><nav class="carpe-order__pagination"><a data-order-next ${page === 1 ? 'href="/?page=2"' : 'hidden'} on:click="/loadMore">Load more products</a></nav><p data-load-status role="status"></p><div class="carpe-order__toolbar carpe-order__enhanced"><p>Selected: <strong data-order-count>0</strong></p><button data-order-clear on:click="/clearSelection">Clear selection</button><button data-order-submit on:click="/addSelected" disabled>Add selected to cart</button><a href="/cart">View cart</a><p data-order-status role="status"></p></div><script type="application/json" data-order-messages>${JSON.stringify(messages)}</script></carpe-collection-order-component>`;
let mode = 'success';
let posts = [];
let pageRequests = 0;
let cartItems = [];
let errors = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/cart/add.js') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    posts.push(payload);
    res.setHeader('Content-Type', 'application/json');
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (mode === 'reject') { res.statusCode = 422; return res.end(JSON.stringify({ status: 422, description: 'Sold out' })); }
    cartItems = payload.items;
    return res.end(JSON.stringify({ items: payload.items, sections: { 'cart-section': '<div>Updated cart</div>' } }));
  }
  if (url.pathname === '/cart.js') {
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'sync-fail') { res.statusCode = 500; return res.end('{}'); }
    return res.end(JSON.stringify({ items: cartItems, item_count: cartItems.reduce((n, item) => n + item.quantity, 0) }));
  }
  if (url.searchParams.has('page')) {
    pageRequests++;
    if (mode === 'page-fail') { res.statusCode = 500; return res.end('Unavailable'); }
    return res.end(markup(2));
  }
  res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
  if (url.pathname === '/component.js') return res.end(read('assets/component.js'));
  if (url.pathname === '/order.js') return res.end(read('assets/carpe-collection-order.js'));
  if (url.pathname === '/utilities.js') return res.end('export const requestIdleCallback = (callback) => window.requestIdleCallback(callback);');
  if (url.pathname === '/renderer.js') return res.end('export const sectionRenderer = { async getSectionHTML(id, cache, url, signal) { return (await fetch(url, {signal})).text(); } };');
  if (url.pathname === '/events.js') return res.end(`export const StandardEvents={cartLinesUpdate:"cart:update"};export class CartLinesUpdateEvent extends Event {
    constructor(options) { super('cart:update', {bubbles:true}); Object.assign(this, options); }
    static createPromise() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise, resolve, reject}; }
    static createCartFromAjaxResponse(cart) { return cart; }
  }`);
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root {--color-background:#fff;--color-foreground-rgb:20 30 40;--color-border:#ddd;--color-primary-button-background:#103e57;--color-primary-button-text:#fff;--color-input-background:#fff;--color-input-text:#222;--color-input-border:#bbb}*{box-sizing:border-box}body{font:16px Arial;margin:16px}button,a{min-height:44px} ${css}</style><script type="importmap">{"imports":{"@theme/component":"/component.js","@theme/utilities":"/utilities.js","@theme/section-renderer":"/renderer.js","@shopify/events":"/events.js"}}</script></head><body>${markup(1, url.searchParams.has('auto'))}<cart-items-component data-section-id="cart-section"></cart-items-component><script>window.cartEvents=[];document.addEventListener('cart:update',e=>e.promise.then(result=>window.cartEvents.push(result)).catch(()=>{}));</script><script type="module" src="/order.js"></script></body></html>`);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(String(error)));
    const fresh = async (suffix = '') => {
      mode = 'success'; posts = []; cartItems = []; pageRequests = 0;
      await page.goto(origin + suffix);
      await page.waitForSelector('[data-enhanced]');
    };
    const setQty = (id, value) => page.$eval(`[data-variant-id="${id}"]`, (input, value) => {
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    const value = (id) => page.$eval(`[data-variant-id="${id}"]`, (input) => input.value);
    await fresh();
    await page.click('[data-product-id="102"] [data-delta="1"]');
    assert.equal(await value(102), '4');
    await page.click('[data-product-id="102"] [data-delta="1"]');
    assert.equal(await value(102), '6');
    await page.click('[data-product-id="102"] [data-delta="-1"]');
    await page.click('[data-product-id="102"] [data-delta="-1"]');
    assert.equal(await value(102), '0');
    await setQty(102, 10);
    await page.click('[data-product-id="102"] [data-delta="1"]');
    assert.equal(await value(102), '10');
    await setQty(102, 5);
    await page.click('[data-order-submit]');
    assert.equal(posts.length, 0);
    assert.equal(await page.$eval('[data-variant-id="102"]', (input) => input.validity.customError), true);
    await page.click('[data-order-clear]');
    await setQty(101, 2);
    await page.click('[data-order-next]');
    await page.waitForSelector('[data-product-id="103"]');
    assert.equal(await value(101), '2');
    assert.equal(await page.$$eval('[data-order-row]', (rows) => rows.length), 3);
    await setQty(103, 3);
    await page.evaluate(() => { const component = document.querySelector('carpe-collection-order-component'); component.addSelected(); component.addSelected(); });
    await page.waitForFunction(() => document.querySelector('[data-order-status]').textContent === 'Added');
    assert.deepEqual(posts[0].items, [{id:101,quantity:2},{id:103,quantity:3}]);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].sections, 'cart-section');
    assert.equal(await value(101), '0');
    assert.equal(await page.evaluate(() => window.cartEvents[0].cart.item_count), 5);
    console.log('PASS quantity rules, preserved selections, deduplication, bulk payload, double-click guard, cart event');

    await fresh(); mode = 'reject';
    await setQty(101, 1); await page.click('[data-order-submit]');
    await page.waitForFunction(() => document.querySelector('[data-order-status]').textContent.includes('Review cart'));
    assert.equal(await page.$eval('[data-order-submit]', (button) => button.disabled), true);
    await page.evaluate(() => document.querySelector('carpe-collection-order-component').addSelected());
    assert.equal(posts.length, 1);
    await page.click('[data-order-clear]');
    assert.equal(await value(101), '0');
    console.log('PASS rejected cart locks selection and requires explicit clearing');

    await fresh(); mode = 'sync-fail';
    await setQty(101, 1); await page.click('[data-order-submit]');
    await page.waitForFunction(() => document.querySelector('[data-order-status]').textContent === 'Added; view cart');
    assert.equal(await value(101), '0'); assert.equal(posts.length, 1);
    console.log('PASS confirmed POST followed by failed cart refresh does not duplicate selections');

    await fresh(); mode = 'page-fail';
    await setQty(101, 2); await page.click('[data-order-next]');
    await page.waitForFunction(() => document.querySelector('[data-load-status]').textContent === 'Retry loading');
    assert.equal(await value(101), '2'); assert.equal(pageRequests, 1);
    mode = 'success'; await page.click('[data-order-next]');
    await page.waitForSelector('[data-product-id="103"]');
    assert.equal(await value(101), '2');
    console.log('PASS pagination failure and manual retry preserve quantities');

    await fresh('/?auto=1');
    await page.waitForSelector('[data-product-id="103"]');
    assert.equal(pageRequests, 1);
    await page.evaluate(() => { const component = document.querySelector('carpe-collection-order-component'); component.remove(); document.body.prepend(component); });
    await page.click('[data-product-id="101"] [data-delta="1"]');
    assert.equal(await value(101), '1');
    console.log('PASS automatic pagination and component reconnect without duplicate listeners');

    // Horizon's visually-hidden labels are absolutely positioned. They must stay
    // inside the scrolling region rather than extending the document's width.
    await page.addStyleTag({content: '.test-hidden-label { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }'});
    await page.evaluate(() => {
      for (const input of document.querySelectorAll('[data-order-quantity]')) {
        const label = document.createElement('span');
        label.className = 'test-hidden-label'; label.textContent = 'Quantity for this product';
        input.before(label);
      }
    });
    await page.setViewport({width:375,height:812});
    const dimensions = await page.evaluate(() => {
      const scroll = document.querySelector('.carpe-order__scroll');
      scroll.scrollLeft = 200;
      return {viewport:innerWidth, body:document.documentElement.scrollWidth, width:scroll.clientWidth, table:scroll.scrollWidth, left:scroll.scrollLeft};
    });
    assert.ok(dimensions.body <= dimensions.viewport);
    assert.ok(dimensions.table > dimensions.width);
    assert.ok(dimensions.left > 0);
    await page.evaluate(() => document.documentElement.dir = 'rtl');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS mobile horizontal scroll, no page overflow, RTL');
    const noJs = await browser.newPage(); await noJs.setJavaScriptEnabled(false); await noJs.goto(origin);
    assert.equal(await noJs.$eval('.carpe-order__quantity', (element) => getComputedStyle(element).display), 'none');
    assert.notEqual(await noJs.$eval('.carpe-order__fallback', (element) => getComputedStyle(element).display), 'none');
    await noJs.close();
    assert.deepEqual(errors, []);
    console.log('PASS no-JavaScript fallback; no browser exceptions');
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
