# Ordering-table size tabs

## Product manager: put an item under a tab

1. Open **Products** in Shopify and select the individual item sold in the table (not the display product page).
2. Scroll to **Metafields**. Open **View all** if needed and find **Quick order group**.
3. Enter the tab label, for example **9mm**, **12mm**, or **25mm**. Use the same spelling for items that belong together.
4. Save. Refresh the development preview of the product-group page.

The item must still belong to that page's **Ordering table products** collection, as in the existing setup. The group field chooses its tab; it does not add it to a collection.

No template editing or new menu link is needed for a new tab label. Labels sort naturally (9mm before 25mm). Capitalization differences are treated as the same group. Blank fields retain the original single-table layout when no products are grouped. If grouped and ungrouped items are mixed, blank items appear in **Other items** so they are not lost.

Quantities remain selected when changing tabs. **Add selected to cart** includes selected items from every tab. **Clear selection** clears all tabs.

## Temporary demonstration

Open `/products/dowel-size-tabs-sample-tab` in development theme **carpe-quick-order** (ID `189153181883`).

- **9mm:** Birch Dowel 9mm x 300mm sample-tab; Birch Dowel 9mm x 600mm sample-tab.
- **12mm:** Birch Dowel 12mm x 300mm sample-tab; Birch Dowel 12mm x 600mm sample-tab.
- **25mm:** Birch Dowel 25mm x 300mm sample-tab; Birch Dowel 25mm x 600mm sample-tab.

All seven product titles (the six items and the display product) end with **sample-tab**. Search Products for `sample-tab` to find them. They also carry tag `carpe-sample-tabs-v1`.

These are sample records shared across Shopify themes, not real stock. They are published only to Online Store, marked hidden from search/sitemaps, and are not added to existing menus or product ranges. The six items use illustrative prices in the store's existing currency and untracked inventory for cart testing. The display product has tracked stock zero and cannot be purchased directly. No checkout/order should be placed for these samples.

After review, delete the seven sample products and the collection **Ordering items sample-tab**. Keep the **Quick order group** field definition and theme code if you want to use tabs for real products. Exact resource IDs are saved in `docs/sample-tabs-state.json`. Removing these sample records does not require removing the tab feature.

## Implementation and performance

`custom.quick_order_group` is a single-line product metafield. Tabs are generated automatically from it. A lightweight, paginated collection view (`collection.order-groups.liquid`) discovers group labels from the entire collection without rendering images, prices or all ordering-table rows. It fetches no customer or cart information and needs no API key in the theme.

Existing row pagination remains in place. Selecting a tab whose rows have not yet been loaded advances the existing batches until that group is found. Already loaded rows and quantities are reused; switching back does not fetch them again. In a large collection, reaching a group late in the collection can require several sequential batches. This is not server-side group filtering. A failed directory or row request has an explicit retry and does not loop automatically.

Tabs support keyboard arrows, Home/End, RTL and horizontal phone scrolling. Without JavaScript, rows remain visible and retain their original individual-product links.

Setup script: `scripts/setup-sample-tabs.cjs`. It uses existing Shopify CLI authorization, records an audit outside public assets, refuses conflicting handles, and checks original products, collections and menus were not changed. Do not publish the theme or change existing inventory as part of sample setup.
