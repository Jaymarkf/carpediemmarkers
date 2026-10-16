# CARPE DIEM
## Product manager's step-by-step guide

**For the modified Shopify theme • Updated 16 October 2026**

### The everyday job

**Upload a color product → add its group tag → save → check the table.**

For the three groups already set up, you do not need to edit a menu or create another page whenever you add a color.

| If you want to… | Follow… |
| --- | --- |
| Add one new color | Page 2 |
| Upload many colors using a spreadsheet | Page 3 |
| Put a product-group page under a brand/category | Page 4 |
| Add or change a menu link | Page 5 |
| Set up a completely new product group | Pages 6–7 |
| Check the result or fix a missing item | Page 8 |

### Three words to know

- **Brand/category:** the collection shoppers browse, such as OLO, COPIC or Posca.
- **Product group:** a product page such as OLO PREMIUM MARKERS - BRUSH. It contains the ordering table. Earlier notes call this a “range”; both words mean the same thing here.
- **Color product:** the actual item sold, with its own SKU, price, image and stock. Each color is a separate Shopify product in this setup.

**Customer journey:** See All Manufacturers → OLO → OLO PREMIUM MARKERS - BRUSH → choose colors and quantities → Add selected to cart.

### Before you start

The modified theme is currently a development preview called **carpe-quick-order**. Ask the store owner for its current preview link. The original live theme may look different. Store records and menus are shared across themes; this preview is not a separate store.

The three existing groups are ready to maintain. A new group also needs the one-time setup on pages 6–7. Missing template names must be resolved by the theme administrator before that setup is finished.

<!-- pagebreak -->

## 1. Add one color to an existing group

**Example: add a new color to OLO Brush.**

1. Sign in to Shopify and open **Products**.
2. Click **Add product**. Enter a clear name, such as **OLO Premium Marker Brush – New Blue**. This is an example name; use the actual item's name.
3. Upload its image. Enter the selling price, SKU and barcode/UPC, if available. Use the real SKU; do not copy another item's SKU.
4. Enter the item's stock and shipping information using your store's normal process.
5. In **Product organization**, find **Tags**. Add the exact tag from the table below. Press Enter or select the tag so Shopify accepts it.
6. Keep this as **one product with one sellable item**. Do not add multiple Color or Size options for this table setup. Leave its theme template as **Default product**.
7. When ready to sell, set **Status** to **Active** and make the product available to **Online Store** in the Publishing/Sales channels area. Click **Save**.
8. Open the modified theme preview. Go through the brand menu to the product-group page. Refresh and find the new item in the table. Scroll down or use **Load more products** if needed.

### Copy the correct tag

| Product group | Exact tag to add |
| --- | --- |
| OLO Premium Markers - Brush | `range-olo-brush` |
| Copic Sketch Markers | `range-copic-sketch` |
| POSCA PC-05M Medium / PC-5M | `range-posca-pc-5m` |

**Finished result:** the new color appears as a row with its SKU, price and quantity controls. No new menu link is needed for each color.

**Remember:** the brand name or Shopify's Category field alone does not put a color into a table. The matching tag does that. These three group tags are already connected to the correct tables.

<!-- pagebreak -->

## 2. Upload many colors with a CSV file

**Use this when you have a prepared spreadsheet of new products.**

1. Use the approved **Shopify-format CSV** for this store. Do not upload the original BigCommerce export directly.
2. Give each new color its own product record and unique product handle. A handle is the product's URL name. Keep the approved CSV column headings and image-row structure unchanged.
3. Enter each item's name, SKU, selling price, image information and barcode, where available. Set the correct group tag on each product in the CSV's **Tags** column.
4. For example, every new OLO Brush color needs **range-olo-brush**. Copic Sketch needs **range-copic-sketch**. POSCA PC-5M needs **range-posca-pc-5m**. If several tags are used, follow the approved CSV format so they remain separate tags.
5. In Shopify, open **Products → Import**, select the CSV, then continue to the import review.
6. For **new products only**, leave **Overwrite products with matching handles** unchecked. For an intentional update, export a backup first and have the manager confirm which existing products and fields should be replaced. A blank field in an update file can clear existing information.
7. Review the product count, names and prices. Choose the intended sales channels, then confirm the import.
8. After it completes, open a few imported products. Check the accepted tag, SKU, image, price, Active status and Online Store availability. Verify actual stock separately; product imports are not a replacement for your normal inventory process.
9. Open the correct product-group page in the modified theme preview. Find a few imported colors and check their details.

### A simple check before importing

- One color is one individual product in the current setup.
- Each new product has a unique handle and SKU.
- The correct group tag is included.
- Prices and barcodes are correct. Keep barcode values as text so leading zeroes are preserved.
- The file is the Shopify version, not the BigCommerce version.

**Finished result:** the imported colors automatically join their existing tables through their tags. The menu stays the same.

<!-- pagebreak -->

## 3. Assign a product group to a brand/category

**In this theme, a storefront category is a Shopify collection.** The OLO collection contains the **OLO Brush product-group page**. The individual colors belong in that page's table.

### Existing brand collections

| Brand/category | Product-group page currently inside it |
| --- | --- |
| COPIC | COPIC SKETCH MARKERS |
| OLO | OLO PREMIUM MARKERS - BRUSH |
| Posca | PC-05M Medium |

### Add another group page to an existing brand

1. Complete the new group's setup on pages 6–7 first. Adding a name to a collection does not build a table by itself.
2. Open **Products → Collections**.
3. Open the brand collection, for example **OLO**.
4. In its product list, click **Browse**, **Add products**, or **Edit products**, depending on the label shown in your admin.
5. Find and select the **product-group page**, such as **OLO PREMIUM MARKERS - CHISEL**. Do not select all its individual colors for this brand's group listing.
6. Confirm the selection and click **Save** if shown. Keep this collection's **Theme template** as **product-ranges**.
7. Also open **See All Manufacturers** and add the new product-group page to its product list. That collection currently displays all the sample group pages together.
8. Check the preview. Clicking **OLO** should show a card for each OLO group. Clicking a card should open that group's product page and table.

**Finished result:** the brand page shows the new group as a product card. The group menu link is added separately on page 5.

### Do not mix up these two jobs

- **Adding a color to a table:** put the group tag on the color product. Follow page 2.
- **Adding a group page under a brand:** add the group-page product to the brand collection. Follow this page.

Shopify also has a **Category** field for classifying a product. Filling that field does not create this store's brand menu or choose an ordering table.

<!-- pagebreak -->

## 4. Add or change a menu link

**The menu already created for this theme is:**

**Carpediem - sample range navigation**

1. Open **Content → Menus** in Shopify.
2. Open **Carpediem - sample range navigation**. This is the menu selected in the modified preview's header. Editing a different menu may not change that header.
3. To add an item, click **Add menu item**. To change one, click the existing item.
4. Enter the name customers should see.
5. For a brand heading such as **OLO**, choose **Collections**, then select the **OLO** collection.
6. For a group link such as **OLO PREMIUM MARKERS - BRUSH**, choose **Products**, then select that product-group page. Select the Shopify resource from the list; you do not need to type a URL.
7. Add or confirm the item. Use the drag handle to move a brand beneath **SEE ALL MANUFACTURERS**, indented one level.
8. Move its group product beneath the matching brand, indented one more level. The three levels are: manufacturer heading → brand collection → group product.
9. Click **Save** or **Save menu**.
10. Refresh the modified theme preview. Test both the brand link and the product-group link. On a phone, open the menu button first.

### Correct example

**SEE ALL MANUFACTURERS** → Collection: See All Manufacturers

　**OLO** → Collection: OLO

　　**OLO PREMIUM MARKERS - BRUSH** → Product: OLO PREMIUM MARKERS - BRUSH

### If the menu does not appear

Open **Online Store → Themes**, find the working theme, then choose **Edit theme/Customize**. In the header's Menu block, select **Carpediem - sample range navigation** and save. Ask the theme administrator if you cannot access that setting.

**Do not paste a localhost address such as 127.0.0.1 into a backend menu.** Localhost works only on the developer's computer. The selected product/collection links work on the store's domain.

<!-- pagebreak -->

## 5. Set up a completely new group — part A

**One-time setup. Example only: OLO Chisel. It has not already been created.**

Do these steps only when a group does not exist yet. For another color in OLO Brush, Copic Sketch or POSCA PC-5M, use page 2 instead.

### A. Choose one group tag

1. Agree on a new tag, for example **range-olo-chisel**. Write it down and use exactly the same tag for all that group's color products.
2. Create or upload the individual color products with that tag. Keep each as a separate product with one sellable item, its actual price and stock, and the Default product template.

### B. Create the collection that supplies the table

3. Open **Products → Collections → Create/Add collection**.
4. Name it **Ordering rows - OLO PREMIUM MARKERS - CHISEL**. “Ordering rows” means it supplies the individual items in the table. It is separate from the customer-facing OLO brand collection.
5. Choose the collection option that adds products automatically using conditions: **Smart/Automated**, or **Products** as the source if your admin uses the newer collection screen.
6. Set the condition to **Product tag / Tag → is equal to → range-olo-chisel**. Save and confirm the list contains only the intended color products. If your admin only offers manually selected products, ask the theme administrator to create the tag-based collection.
7. Make this supporting collection available to **Online Store**. Leave its page template as the normal collection template. Do not add this supporting collection to the customer menu.

### C. Create the group's product page

8. In **Products**, open the existing **OLO PREMIUM MARKERS - BRUSH** group-page product. Choose **Duplicate**. Rename the copy **OLO PREMIUM MARKERS - CHISEL** and keep the copy in **Draft** while setting it up.
9. Replace its image and description with the correct Chisel information. Keep **Theme template = range-order**.
10. This group page introduces the table; it is not the stock item customers buy. Keep **Track quantity ON**, **available stock 0 at every location**, and **Continue selling when out of stock OFF** for this group-page product. Actual sale prices and stock belong to the individual colors.

**Before continuing:** if **range-order** is missing from the template list, ask the theme administrator. Shopify lists templates from the live theme; the modified template may still exist only in preview. Do not choose a different template as a substitute.

<!-- pagebreak -->

## 6. Set up a completely new group — part B

**Continue the OLO Chisel example from page 6.**

### D. Connect the table and the brand

11. On the copied group-page product, scroll to **Metafields**. These are extra product fields. Use **View all/Show all** if the fields are not visible.
12. In **Ordering table products**, select the new collection **Ordering rows - OLO PREMIUM MARKERS - CHISEL**. Replace the copied Brush collection. The field's internal name is **custom.order_table_collection**; you only need to select a collection.
13. In **Range brand collection**, select **OLO**. This adds the correct brand link above the product-page heading. Its internal name is **custom.range_brand**.
14. Do not add **range-olo-chisel** to the group-page product itself. That tag belongs to the individual color products. Save the group-page product.

### E. Put the group on the storefront

15. Add the **OLO PREMIUM MARKERS - CHISEL** group-page product to the **OLO** collection and **See All Manufacturers** collection, as shown on page 4.
16. When its setup is ready, set the group-page product to **Active**, make it available to **Online Store**, and save. Its display stock stays at zero; do not add stock to make the group page look available.
17. Add a **Product** menu link beneath **OLO**, using page 5. Select the new group-page product, not the “Ordering rows” collection.
18. Preview the group page. Confirm the heading, brand link, image and color rows all belong to Chisel. Try quantities on more than one row and confirm the cart contains those color items.

### If the brand itself is also new

Before step 13, create the customer-facing brand collection in **Products → Collections**. Name it after the brand, choose **Manual** or the option to pick specific products, and add its group-page products. Assign **Theme template = product-ranges** and make it available to Online Store. Select it in **Range brand collection**. Then add its Collection menu link under **SEE ALL MANUFACTURERS**, with its Product group links below it.

If **product-ranges** or either extra product field is missing, ask the theme administrator to finish the initial theme setup. No code editing is part of the product manager's job.

**Finished result:** a new group has its own product page and table. After this one-time setup, later colors need only their normal product details and the matching tag.

<!-- pagebreak -->

## 7. Check the page and solve common problems

### Two-minute check after an upload or menu change

1. Open the modified theme preview, then follow **See All Manufacturers → brand → product group**.
2. Check one new color's name, SKU, price, barcode and image.
3. Find items farther down the table. More rows load when scrolling; there is also a **Load more products** link.
4. Enter quantities for two items and click **Add selected to cart**. Check that the cart contains those exact colors and quantities. Do not place an order for a simple content check. Remove your test items afterward.
5. On a phone, swipe the table sideways to reach the quantity controls. Check the phone menu links too.

### If something is missing

| What you see | What to check |
| --- | --- |
| New color is missing | Exact group tag; Active status; Online Store availability; correct product-group page. Refresh after saving and allow the collection to update. |
| A color appears in the wrong table | Remove the incorrect group tag and add the intended tag. |
| Color is marked sold out | Check that color product's actual stock and selling settings. Do not change the group-page display stock. |
| “Choose options” instead of quantity buttons | That color product may have several variants or require a subscription. This table's normal rows use separate products with one sellable item. |
| Group's table is empty or shows the wrong colors | On the group-page product, check **Ordering table products** and the selected collection's product list. |
| Group card is missing from a brand page | Add the group-page product to that brand collection. Confirm both are available to Online Store. |
| Menu change is missing | Edit the menu used by the header, save, and check the working theme preview. |
| No range-order or product-ranges template | Ask the theme administrator to make the templates available in the live theme before assigning new pages. |
| Page not found | Check Active status, Online Store availability, and the menu's selected product/collection. Do not guess or type a new URL. |

**A store product page's URL starts with /products/. A brand collection's URL starts with /collections/.** You do not add **?view=quick-order** for the current group product pages.

### Official Shopify help

[Product CSV imports](https://help.shopify.com/en/manual/products/import-export/import-products) • [Collections](https://help.shopify.com/en/manual/products/collections) • [Editing menu items](https://help.shopify.com/en/manual/online-store/menus-and-links/editing-menus) • [Assigning theme templates](https://help.shopify.com/en/manual/online-store/themes/theme-structure/templates)

This guide describes the customized Carpediem theme. Shopify may change button labels; the store's tag names and extra product fields above are specific to this setup.
