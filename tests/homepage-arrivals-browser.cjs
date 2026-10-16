// Read-only preview check: node tests/homepage-arrivals-browser.cjs <puppeteer> <chrome> <origin> <state-json> <screenshots>
const [puppeteerModule, executablePath, origin, stateFile, screenshotDir] = process.argv.slice(2);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require(puppeteerModule);
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const expected = state.enabledProducts.map(product => '/products/' + product.handle).sort();
fs.mkdirSync(screenshotDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const previewUrl = pathname => new URL(pathname + '?preview_theme_id=189153181883', origin).href;
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 60000 });
    assert.notEqual(new URL(page.url()).pathname, '/password', 'Preview requires storefront access');
    const section = '[data-testid="product-list"]';
    await page.waitForSelector(section + ' .carpe-range-card');
    const links = await page.$$eval(section + ' .carpe-range-card', cards => cards.map(card => card.getAttribute('href')).sort());
    assert.deepEqual(links, expected);
    assert.equal(await page.$$eval(section + ' .resource-list__item', items => items.length), 3);
    assert.equal(await page.$(section + ' quick-add-component'), null);
    assert.match(await page.$eval(section + ' .section-resource-list__header', el => el.textContent), /New arrivals/i);
    assert.ok(!/sample-tab/i.test(await page.$eval(section, el => el.textContent)));
    assert.equal(await page.$$eval(section + ' .carpe-range-card img', images => images.filter(image => image.complete && image.naturalWidth > 0).length), 3);
    await page.$eval(section, element => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(screenshotDir, 'arrivals-desktop.png'), fullPage: false });
    console.log('PASS homepage: three main table pages, working images, New arrivals title, no individual/sample items or quick-add');

    for (const width of [375, 320]) {
      await page.setViewport({ width, height: 812 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow at ' + width);
      const sizes = await page.$$eval(section + ' .carpe-range-card', cards => cards.map(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height })));
      assert.ok(sizes.every(size => size.width > 0 && size.width <= width && size.height > 0));
      await page.$eval(section, element => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: path.join(screenshotDir, 'arrivals-mobile-' + width + '.png'), fullPage: false });
      console.log('PASS ' + width + 'px: responsive cards, no horizontal page overflow');
    }

    await page.goto(previewUrl('/collections/' + state.collection.handle), { waitUntil: 'networkidle2', timeout: 60000 });
    const collectionLinks = await page.$$eval('main .carpe-range-card', cards => cards.map(card => card.getAttribute('href')).sort());
    assert.deepEqual(collectionLinks, expected);
    console.log('PASS View all collection shows the same three table pages');

    await page.goto(previewUrl(expected[0]), { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('[data-order-row]');
    assert.ok(await page.$('carpe-collection-order-component'));
    console.log('PASS destination is a real product page with its ordering table intact');

    await page.setJavaScriptEnabled(false);
    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 60000 });
    assert.deepEqual(await page.$$eval(section + ' .carpe-range-card', cards => cards.map(card => card.getAttribute('href')).sort()), expected);
    console.log('PASS three arrival cards render without JavaScript or catalog-fetch requests');
    assert.deepEqual(errors, []);
    console.log('PASS no browser runtime errors; no cart, products or orders modified by preview test');
  } catch (error) {
    console.error(JSON.stringify({ url: page.url(), body: await page.evaluate(() => document.body.innerText.slice(0, 1500)), errors }));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
