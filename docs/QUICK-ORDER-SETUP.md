# Collection quick order

> This guide describes the earlier collection-page preview. The current customer flow uses real product pages and brand collections. See [PRODUCT-RANGES.md](PRODUCT-RANGES.md) for the current setup; do not follow the old collection-creation steps below for the new navigation.

This feature groups **separate products** on collection pages. It does not create parent products or merge inventory. Normal product pages are unchanged.

## Store setup

In Shopify, create these automated collections with the condition **Product tag is equal to**:

| Collection | Exact tag | Expected sample count |
| --- | --- | --- |
| OLO Premium Markers - Brush | `range-olo-brush` | 34 |
| Copic Sketch | `range-copic-sketch` | 33 |
| POSCA PC-5M | `range-posca-pc-5m` | 33 |

Make the imported products and collections available to the Online Store. Add a collection description and image for each range. These supply the heading, introduction and image without duplicating them in theme code.

Use the **quick-order** collection template for all three collections. In the theme editor, adjust its color scheme, image/barcode columns, products per batch (12–48, default 24), and automatic loading. An optional image override applies to every collection using that template; leave it empty to use each collection's own image.

The admin template picker normally lists templates available in the published theme. Before publishing, preview the alternate template on a development theme using a collection URL with `?view=quick-order` (preserve any preview theme parameters). Do not publish just to test. Once the approved template is available in the live theme, assign it in each collection's admin page. Link the last navigation level directly to these collections.

## Optional swatches

Create a **product** metafield definition named Swatch color, namespace/key `custom.swatch_color`, type **Color**. A filled value replaces that row's image with a circular swatch. Missing values use the imported product image; missing images show a dash. No colors are guessed from names. SKU and UPC/barcode come from the product's variant data and remain editable in Shopify.

## Behavior and safeguards

- Initial rows, prices and availability render in Liquid. Later rows use Shopify section rendering, without one product API call per row.
- Scroll near the bottom to append another batch. A Load more link also works manually. A failed request requires an explicit retry. Existing quantities remain untouched.
- Quantity controls honor minimum, increment and maximum rules. Zero means unselected. Shopify rechecks stock and final prices at cart submission.
- One request adds all selected rows, using Horizon's standard cart events to update its drawer and count. Drawer auto-open follows existing theme settings.
- Cart errors can represent partial changes. The selection is locked until Clear selection; the message asks the shopper to review the cart first. POST requests are never automatically retried.
- Selections persist during row loading, not across refreshes or navigation. No permanent browser cache is used for prices or availability.
- Sold-out products cannot be added. Products with multiple variants or required selling plans link to their normal product page to choose options safely.
- The table scrolls horizontally on small screens. Without JavaScript, product links and server pagination still allow shopping.

## Verification before launch

Run `shopify theme check` from the theme directory. The isolated `carpe-quick-order` development theme is ID `189153181883`. Start its preview with `shopify theme dev --store x1j8t7-2r.myshopify.com --theme 189153181883 --port 9293` and sign in interactively if requested. Do not use `--live` or publish during testing.

On each collection, check its expected product count, images, SKU, barcode, currency, prices and stock. Select products from both batches, add them once, and check exact cart quantities and drawer count. Test mobile horizontal scrolling, keyboard controls, sold-out rows, failed page loading, an out-of-stock cart rejection, and refresh after checkout. Check the normal product and collection templates for regressions.

Local browser fixtures cannot verify real Shopify inventory, discounts, markets, rendered Liquid, theme-editor settings or authenticated cart integration. A development-store preview is required for that sign-off.

Run the included controlled browser tests with an installed Puppeteer Core and Chrome:

```text
node tests/collection-order-browser.cjs <theme-directory> <puppeteer-core-module-path> <chrome-executable-path>
```

The new interface labels have English fallbacks in the other locale files; existing translations are unchanged. Translate the `carpe_order` namespace before launching this feature in other languages.

## Preview before collection setup

The imported tags also allow temporary range previews without changing store data:

- `/collections/all/range-olo-brush?view=quick-order`
- `/collections/all/range-copic-sketch?view=quick-order`
- `/collections/all/range-posca-pc-5m?view=quick-order`

Append `&preview_theme_id=189153181883` when opening these on the store domain. These temporary pages use the generic **Products** heading because they are filtered views of the all-products collection. Set up the three named collections above for their own headings, descriptions, images and final navigation links.

The development store currently displays prices in PHP (₱). This reflects the store's currency, not a conversion performed by this feature. Verify the store currency and imported price amounts before selling.

## Verified on 15 October 2026

- Theme Check: no errors; six pre-existing warnings in `header.liquid` and `divider.liquid`.
- Controlled Chrome tests: quantity rules, invalid input, duplicate-submit prevention, failed cart response, failed cart refresh, pagination retry, reconnect, mobile/RTL scrolling, and no-JavaScript fallback.
- Shopify development preview: all 100 unique imported products loaded; tag-filtered ranges contained 34 OLO, 33 Copic Sketch and 33 POSCA products.
- Real Ajax cart in an isolated browser: two products from different batches added at quantities 2 and 3; cart contained exactly five units; Horizon cart content/count updated; selections reset. Test cart cleared afterward. No checkout or order created.
- Mobile 375px viewport: no horizontal document overflow; table scrolls to the quantity column. Normal product and default collection templates still render normally. No browser exceptions recorded during this test.
- Three named range collections are not currently visible in the storefront collection listing. Their admin creation, template assignment and navigation links still need store setup. Nothing has been published.
