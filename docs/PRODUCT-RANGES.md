# Real product pages with linked-product ordering tables

This is the current architecture. The earlier collection quick-order preview is retained for compatibility, but it is not the destination of the new navigation.

## Customer flow

| Brand collection | Real range product | Existing table products |
| --- | --- | --- |
| `/collections/copic` | `/products/copic-sketch-markers` | 33 products tagged `range-copic-sketch` |
| `/collections/olo` | `/products/olo-premium-markers-brush` | 34 products tagged `range-olo-brush` |
| `/collections/posca` | `/products/posca-pc-5m-medium` | 33 products tagged `range-posca-pc-5m` |

The menu is **Carpediem - sample range navigation**, handle `carpe-range-preview`, under Shopify **Content > Menus**. It has Home, See All Manufacturers > brand > range product, and the existing Contact destination. Only the three imported ranges are included. Chartpak, OLFA and other ranges have not been migrated.

Brand collections contain range products, not all the individual colors. See All Manufacturers contains the three range products. Clicking a brand shows its range card; clicking that card or the last menu level opens a real `/products/` page. No `?view=quick-order` is required.

These four customer-facing collections use **collection.product-ranges**. Its cards link to the ordering pages without misleading display-variant availability/price filters. Other collection templates are unchanged.

## Backend relationships

Each range is a real Shopify product using **product.range-order**. Two editable product metafields control its content:

- `custom.order_table_collection` (Collection reference): supporting collection of the original color products.
- `custom.range_brand` (Collection reference): customer-facing brand collection and breadcrumb destination.

Supporting collections named **Ordering rows - ...** use the existing CSV tags. They supply products to Liquid pagination and are not linked in the customer menu. They must be available on the Online Store for the product reference to resolve.

The table products remain independent Shopify products, NOT native variants of the range display product. Add to cart submits the actual color product variant IDs. Their SKUs, barcodes, images, prices and inventories are untouched.

## Display-product safety

Shopify creates a default variant for every product. The three range display variants have tracked stock of zero and inventory policy DENY. They cannot be purchased directly. Do not add inventory to them or enable selling when out of stock.

Range cards use a dedicated **Choose options** link rather than showing the display variant's stock/price or a quick-add button. The ordering page does not render a purchase form for the display variant. Actual stock and prices belong to the color rows.

The display products are active and available only on the Online Store, not POS. `seo.hidden = 1` keeps these preview display records out of search/sitemaps; review this setting when approving a full launch. Store products/collections are shared across themes even though the new theme and menu selection are unpublished. On an older theme without this custom template, a display product may fall back to its normal sold-out product view; it still cannot be purchased.

## Add or edit products

1. Edit an individual color's SKU, price, barcode, image or inventory in its existing product record.
2. Add the matching `range-*` tag to put a new color in the supporting collection and therefore the table.
3. Edit the range product's title, description and image to change the table-page introduction.
4. To build another range later, create its supporting collection, real display product and product metafield links, then add that display product to its brand collection and navigation. Apply the same non-purchasable display-variant safeguards.

The optional product Color metafield `custom.swatch_color` still replaces row images with swatches. Table batch size and image/barcode visibility remain editable in the range-order template.

## Preview and deployment

Development theme **189153181883** (`carpe-quick-order`) is used for verification, including the current local preview at **http://127.0.0.1:9292**. Its header selects the separate `carpe-range-preview` menu. The existing `main-menu`, footer and customer-account menus are unchanged, and the live theme is not published or replaced.

Preview a range using the store URL plus `?preview_theme_id=189153181883`. On the local development server, the clean product path works directly.

```text
shopify theme dev --store x1j8t7-2r.myshopify.com --theme 189153181883 --port 9292
```

Before production launch, approve the template/card files and header menu selection together. The new backend records alone do not install the product-page table in the old live theme. No customer, order, payment, currency or existing inventory settings were changed.

### Upload dependency order

The table section's schema must allow both `collection` and `product` templates. An older development theme still had the collection-only section, which caused **Section 'main' is not supported on product templates** when the new product template was uploaded there.

When syncing these changes into another preview, upload `sections/carpe-collection-order.liquid`, `sections/carpe-brand-ranges.liquid`, their snippets, assets and locale keys first. Once those succeed, upload `templates/product.range-order.json`, `templates/collection.product-ranges.json` and the preview header/menu selection. Use the explicit theme ID above so another development theme is not selected by mistake.

## Setup and audit

`scripts/setup-product-ranges.cjs` uses the Shopify CLI's authorized Admin API access. It is deliberately scoped to the 100-product sample and checks the expected tag counts. Existing resource handles are reused only when marked as belonging to this setup. It snapshots the catalog/menu before and after and checks that all existing color products and original menus are unchanged.

Do not rerun `--apply` casually on a changed catalog. Keep the generated JSON audit files outside the public assets directory. No tokens or passwords are stored in the project.

Resource IDs and the exact backend menu hierarchy are recorded in `docs/range-setup-state.json`. That file contains no credentials.

## Verification completed on 16 October 2026

- Synced section dependencies first, then product/collection templates and the header menu into development theme `189153181883`. Both uploads succeeded without errors.
- Tested the actual local preview at `http://127.0.0.1:9292`: desktop dropdown, mobile menu, brand cards, clean product URLs, and all 33 Copic / 34 OLO / 33 Posca color rows.
- Loading the next batch preserved entered quantities and produced no duplicate rows. The 375px mobile table scrolls horizontally without widening the page.
- Real cart test added two original color products at quantities 2 and 3, totaling exactly five units. The display product was not included. A direct attempt to buy its zero-stock variant was rejected by Shopify.
- Existing individual product pages still rendered their original purchase form. No browser exceptions were recorded. The isolated test cart was cleared; no checkout or order was created.
- Theme Check and JavaScript syntax checks passed. Theme Check reports only the six existing warnings in `header.liquid` and `divider.liquid`.
- Theme remains a development preview; the live theme was not published.
