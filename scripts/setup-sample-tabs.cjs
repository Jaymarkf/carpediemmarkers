/** Create only the approved, removable sample-tab records. No tokens are read or saved.
 * node scripts/setup-sample-tabs.cjs <shopify-cli-run.js> <audit-directory> [--apply]
 * Without --apply: read-only audit. With --apply: resumable, marker-checked creation.
 */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const [cli, audit, apply] = process.argv.slice(2);
if (!cli || !audit) throw new Error('CLI path and audit directory are required.');
fs.mkdirSync(audit, {recursive:true});
const store = 'x1j8t7-2r.myshopify.com';
const marker = 'carpe-sample-tabs-v1';
const state = {store, marker, products:[], collection:null, display:null, definitions:[]};
let sequence = 0;
const save = () => fs.writeFileSync(path.join(audit, 'sample-tabs-state.json'), JSON.stringify(state, null, 2));
function operation(label, query, variables = {}, mutation = false) {
  if (mutation && apply !== '--apply') throw new Error('Mutations require --apply');
  const prefix = path.join(audit, `${String(++sequence).padStart(3, '0')}-${label}`);
  fs.writeFileSync(prefix + '.graphql', query);
  fs.writeFileSync(prefix + '.variables.json', JSON.stringify(variables, null, 2));
  const args = [cli, 'store', 'execute', '--store', store, '--version', '2026-10', '--query-file', prefix+'.graphql', '--variable-file', prefix+'.variables.json', '--output-file', prefix+'.result.json', '--json', '--no-input'];
  if (mutation) args.push('--allow-mutations');
  try {execFileSync(process.execPath, args, {encoding:'utf8', stdio:'pipe', timeout:90000});}
  catch (error) {throw new Error(`${label}: ${error.stdout || ''}\n${error.stderr || error.message}`);}
  const result = JSON.parse(fs.readFileSync(prefix+'.result.json', 'utf8'));
  if (result.errors?.length) throw new Error(JSON.stringify(result.errors));
  for (const item of Object.values(result)) if (item?.userErrors?.length) throw new Error(`${label}: ${JSON.stringify(item.userErrors)}`);
  return result;
}
const inspection = `query {
  shop { name currencyCode }
  products(first:250) { pageInfo { hasNextPage } nodes { id handle title status templateSuffix tags metafields(first:30) { nodes { namespace key type value } } variants(first:10) { nodes { id sku price barcode inventoryPolicy inventoryQuantity inventoryItem { id tracked } } } } }
  collections(first:100) { pageInfo { hasNextPage } nodes { id handle title stamp:metafield(namespace:"custom",key:"order_setup") { value } } }
  menus(first:50) { nodes { id handle title items { id title type url resourceId items { id title type url resourceId items { id title type url resourceId } } } } }
  metafieldDefinitions(first:100,ownerType:PRODUCT,namespace:"custom") { nodes { id key type { name } access { storefront } } }
  publications(first:20) { nodes { id name } }
}`;
const before = operation('before', inspection);
if (before.products.pageInfo.hasNextPage || before.collections.pageInfo.hasNextPage) throw new Error('Catalog larger than audit window; stop for a fresh inspection.');
console.log(`Audited ${before.products.nodes.length} products; currency ${before.shop.currencyCode}.`);
if (apply !== '--apply') process.exit(0);
const publication = before.publications.nodes.find(item => item.name === 'Online Store');
if (!publication) throw new Error('Online Store publication missing.');
function publish(id) {operation('publish-sample', `mutation($id:ID!,$input:[PublicationInput!]!) { publishablePublish(id:$id,input:$input) { userErrors { field message } } }`, {id, input:[{publicationId:publication.id}]}, true);}
for (const [key, name, type, description] of [
  ['quick_order_group', 'Quick order group', 'single_line_text_field', 'Tab label for this individual ordering-table item, for example 9mm. Leave blank on products that do not need tabs.'],
  ['order_table_collection', 'Ordering table products', 'collection_reference', 'Collection of independently stocked items shown in the ordering table.'],
]) {
  const existing = before.metafieldDefinitions.nodes.find(item => item.key === key);
  if (existing && existing.type.name !== type) throw new Error(`Conflicting custom.${key} definition.`);
  if (existing && existing.access.storefront !== 'PUBLIC_READ') throw new Error(`custom.${key} is not storefront-readable; stop before changing its access.`);
  if (!existing) {
    const result = operation('create-definition', `mutation($definition:MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition:$definition) { createdDefinition { id } userErrors { field message } } }`, {definition:{name,namespace:'custom',key,type,description,ownerType:'PRODUCT',access:{storefront:'PUBLIC_READ'}}}, true);
    state.definitions.push({key,id:result.metafieldDefinitionCreate.createdDefinition.id}); save();
  }
}
function ensureProduct(input, sample, isDisplay = false) {
  let product = before.products.nodes.find(item => item.handle === input.handle);
  if (product && (!product.tags.includes(marker) || product.title !== input.title)) throw new Error('Refusing to overwrite ' + input.handle);
  if (!product) {
    const result = operation('create-sample-product', `mutation($product:ProductCreateInput!) { productCreate(product:$product) { product { id title handle variants(first:1) { nodes { id } } } userErrors { field message } } }`, {product:{...input,status:'DRAFT',tags:[marker,'sample-tab',...(isDisplay?['carpe-range-display']:[])],metafields:[...(input.metafields || []),{namespace:'seo',key:'hidden',type:'number_integer',value:'1'}]}}, true);
    product = result.productCreate.product;
    console.log('Created: '+product.title);
  }
  const entry = {id:product.id, title:product.title, handle:product.handle, variantId:product.variants.nodes[0].id, ...sample};
  if (isDisplay) state.display = entry; else state.products.push(entry);
  save();
  // Update only marker-checked sample records; never change existing merchandise.
  const changed = operation('set-sample-variant', `mutation($id:ID!,$variants:[ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId:$id,variants:$variants) { productVariants { id inventoryQuantity inventoryPolicy inventoryItem { tracked } } userErrors { field message } } }`, {id:product.id,variants:[{id:entry.variantId,price:isDisplay?'1.00':sample.price,inventoryPolicy:'DENY',inventoryItem:{tracked:isDisplay,sku:isDisplay?'SAMPLE-TAB-DISPLAY':sample.sku}}]}, true);
  const variant = changed.productVariantsBulkUpdate.productVariants[0];
  if (isDisplay && (!variant.inventoryItem.tracked || variant.inventoryPolicy !== 'DENY' || variant.inventoryQuantity !== 0)) throw new Error('Sample display variant must remain unpurchasable.');
  operation('activate-sample', `mutation($product:ProductUpdateInput!) { productUpdate(product:$product) { product { id } userErrors { field message } } }`, {product:{id:product.id,status:'ACTIVE'}}, true);
  publish(product.id);
  return entry;
}
for (const size of [9,12,25]) for (const length of [300,600]) {
  const group = `${size}mm`;
  const title = `Birch Dowel ${group} x ${length}mm sample-tab`;
  const sku = `SAMPLE-TAB-${String(size).padStart(2,'0')}-${length}`;
  ensureProduct({title,handle:`birch-dowel-${size}mm-${length}mm-sample-tab`,vendor:'Carpediem sample',productType:'Sample tab item',descriptionHtml:'<p>Temporary sample for testing the ordering-table tabs. Delete this sample-tab product after reviewing the demonstration.</p>',metafields:[{namespace:'custom',key:'quick_order_group',type:'single_line_text_field',value:group}]}, {group,sku,price:(1 + size/100 + length/1000).toFixed(2)});
}
const collectionHandle = 'ordering-items-sample-tab';
let collection = before.collections.nodes.find(item => item.handle === collectionHandle);
if (collection && collection.stamp?.value !== marker) throw new Error('Conflicting sample collection.');
if (!collection) {
  const result = operation('create-sample-collection', `mutation($input:CollectionInput!) { collectionCreate(input:$input) { collection { id title handle } userErrors { field message } } }`, {input:{title:'Ordering items sample-tab',handle:collectionHandle,sortOrder:'ALPHA_ASC',products:state.products.map(item=>item.id),metafields:[{namespace:'custom',key:'order_setup',type:'single_line_text_field',value:marker},{namespace:'seo',key:'hidden',type:'number_integer',value:'1'}]}}, true);
  collection = result.collectionCreate.collection;
}
state.collection = {id:collection.id,title:collection.title,handle:collection.handle}; save(); publish(collection.id);
ensureProduct({title:'Dowel size tabs sample-tab',handle:'dowel-size-tabs-sample-tab',vendor:'Carpediem sample',productType:'Range ordering page',templateSuffix:'range-order',descriptionHtml:'<p>Sample ordering table: choose 9mm, 12mm or 25mm, set quantities, and add selected items from multiple tabs together. All six items are temporary samples.</p>',metafields:[{namespace:'custom',key:'order_table_collection',type:'collection_reference',value:collection.id}]}, {}, true);
const after = operation('after', inspection);
for (const product of before.products.nodes.filter(item=>!item.tags.includes(marker))) if (JSON.stringify(after.products.nodes.find(item=>item.id===product.id)) !== JSON.stringify(product)) throw new Error('Original product changed: '+product.handle);
for (const collection of before.collections.nodes.filter(item=>item.stamp?.value!==marker)) if (JSON.stringify(after.collections.nodes.find(item=>item.id===collection.id)) !== JSON.stringify(collection)) throw new Error('Original collection changed: '+collection.handle);
if (JSON.stringify(after.menus) !== JSON.stringify(before.menus)) throw new Error('An existing menu changed.');
if (state.products.length !== 6 || state.products.some(item=>!item.title.endsWith('sample-tab')) || !state.display.title.endsWith('sample-tab')) throw new Error('Unexpected sample product count or naming.');
save();
console.log('VERIFIED: six sample items, one guarded sample display page, one sample collection. Existing products, collections and menus unchanged. No theme published.');
console.log('State: '+path.join(audit,'sample-tabs-state.json'));
