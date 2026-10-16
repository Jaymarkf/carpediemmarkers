# Homepage: New arrivals

## Show a product on the homepage

1. In Shopify, open **Products**.
2. Open the **main product page with the ordering table**, for example **OLO PREMIUM MARKERS - BRUSH**. Do not open an individual color, size or refill item.
3. In **Metafields**, find **Show in new arrivals**. Use **View all** if needed.
4. Set it to **True / On** and click **Save**.
5. Refresh the homepage preview. Shopify may take a short time to update the automatic collection.

To remove that card from the homepage, switch the same field to **False / Off** and save. This does not delete the product or remove its items from the ordering table.

**Simple rule:** main table product = eligible for the homepage; individual table item = leave the homepage switch off.

## What is already set up

- A pinned product checkbox named **Show in new arrivals** (`custom.show_in_new_arrivals`).
- An automatic collection called **New arrivals**, handle `new-arrivals-table-products`, containing products whose switch is True.
- The local homepage product-list section uses that collection with **Only table product pages** enabled.
- The three existing COPIC, OLO and POSCA table pages have their switch enabled. The six individual sample-tab items and their sample display page are not enabled.
- Cards open the real table product page through **Choose options**, rather than offering quick-add for its protected display variant.
- The automatic collection is sorted newest first by product creation date. This switch is manual merchandising control, not an automatic expiry date. The homepage currently displays at most eight cards.

## If a card does not appear

The main product must use theme template **range-order**, have its **Ordering table products** collection selected, be Active and available on Online Store, and have **Show in new arrivals** set to True. A mistaken flag on an individual item will not display it in the modified homepage or this collection's custom template.

The supporting collection and individual products still use the existing setup. Do not change inventory, price, tags or the table collection just to control homepage visibility. Keep the display product's tracked stock at zero; it is not the item shoppers buy.

In the theme editor, the homepage Product list must keep its collection set to **New arrivals** and **Only table product pages** enabled. Other product-list sections retain their normal behavior unless this setting is enabled there as well. The homepage never falls back to All products or sample placeholders when this guarded section is empty.

The saved checkbox and collection are shared store data; local theme modifications are not a live-theme publication. An older theme without the filtering guard will not enforce the custom table eligibility check if an individual item is mistakenly flagged.
