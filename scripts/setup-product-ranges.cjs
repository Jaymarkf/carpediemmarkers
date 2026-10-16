/** Scoped, resumable setup for the approved 100-product sample.
 * Uses Shopify CLI's stored authorization; never reads or saves credentials.
 * Usage: node scripts/setup-product-ranges.cjs <shopify-cli-run.js> <artifact-directory> --apply
 * Without --apply it performs only the inventory/menu inspection.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [cli, artifactDir, apply] = process.argv.slice(2);
const store = 'x1j8t7-2r.myshopify.com';
const marker = 'carpe-sample-ranges-v1';
const ranges = [
  { key:'copic-sketch', tag:'range-copic-sketch', count:33, brand:'COPIC', brandHandle:'copic', title:'COPIC SKETCH MARKERS', handle:'copic-sketch-markers', description:'Choose Copic Sketch marker colors individually. Set the quantities you need in the table below.' },
  { key:'olo-brush', tag:'range-olo-brush', count:34, brand:'OLO', brandHandle:'olo', title:'OLO PREMIUM MARKERS - BRUSH', handle:'olo-premium-markers-brush', description:'Choose OLO brush marker colors individually. Set the quantities you need in the table below.' },
  { key:'posca-pc-5m', tag:'range-posca-pc-5m', count:33, brand:'Posca', brandHandle:'posca', title:'PC-05M Medium', handle:'posca-pc-5m-medium', description:'Choose POSCA PC-5M medium marker colors individually. Set the quantities you need in the table below.' },
];
if (!cli || !artifactDir) throw new Error('CLI path and artifact directory are required');
fs.mkdirSync(artifactDir, {recursive:true});
let sequence = 0;
function operation(label, query, variables = {}, mutation = false) {
  if (mutation && apply !== '--apply') throw new Error('Use --apply to authorize setup writes');
  const prefix = path.join(artifactDir, `${String(++sequence).padStart(3,'0')}-${label}`);
  fs.writeFileSync(prefix+'.graphql', query);
  fs.writeFileSync(prefix+'.variables.json', JSON.stringify(variables,null,2));
  const args = [cli,'store','execute','--store',store,'--version','2026-10','--query-file',prefix+'.graphql','--variable-file',prefix+'.variables.json','--output-file',prefix+'.result.json','--json','--no-input'];
  if (mutation) args.push('--allow-mutations');
  try { execFileSync(process.execPath,args,{encoding:'utf8',stdio:'pipe',timeout:90000}); }
  catch(error) { throw new Error(`${label}: ${error.stdout || ''}\n${error.stderr || error.message}`); }
  const result = JSON.parse(fs.readFileSync(prefix+'.result.json','utf8'));
  if(result.errors?.length) throw new Error(`${label}: ${JSON.stringify(result.errors)}`);
  for(const value of Object.values(result)) {
    if(value?.userErrors?.length) throw new Error(`${label}: ${JSON.stringify(value.userErrors)}`);
  }
  return result;
}
const inspect = `query {
  shop { name currencyCode }
  products(first:250) { pageInfo { hasNextPage } nodes { id title handle status tags vendor templateSuffix featuredImage { url altText } variants(first:1) { nodes { id sku price inventoryQuantity inventoryPolicy inventoryItem { id tracked } } } table:metafield(namespace:"custom",key:"order_table_collection") { value } } }
  collections(first:100) { pageInfo { hasNextPage } nodes { id handle title stamp:metafield(namespace:"custom",key:"order_setup") { value } } }
  menus(first:50) { nodes { id title handle items { id title type url resourceId items { id title type url resourceId items { id title type url resourceId } } } } }
  metafieldDefinitions(first:100,ownerType:PRODUCT,namespace:"custom") { nodes { id key type { name } } }
  publications(first:20) { nodes { id name } }
}`;
const before = operation('before',inspect);
if(before.products.pageInfo.hasNextPage || before.collections.pageInfo.hasNextPage) throw new Error('Catalog exceeds the inspected sample window; stop for a fresh audit');
const publication = before.publications.nodes.find(item=>item.name==='Online Store');
if(!publication) throw new Error('Online Store publication not found');
for(const range of ranges) {
  range.children=before.products.nodes.filter(product=>product.tags.includes(range.tag));
  if(range.children.length!==range.count) throw new Error(`${range.tag}: expected ${range.count}, found ${range.children.length}`);
  if(range.children.some(product=>product.tags.includes(marker))) throw new Error('Display product incorrectly included in table rows');
}
console.log(`Verified ${ranges.reduce((sum,range)=>sum+range.children.length,0)} existing color products. Live menus snapshotted.`);
if(apply!=='--apply') process.exit(0);
const state={store,marker,publicationId:publication.id,ranges:[],created:[],menu:null};
const save=()=>fs.writeFileSync(path.join(artifactDir,'range-setup-state.json'),JSON.stringify(state,null,2));
save();
function created(type,resource) { state.created.push({type,id:resource.id,handle:resource.handle});save();console.log(`Created ${type}: ${resource.handle || resource.id}`);return resource; }
function stamp() {return {namespace:'custom',key:'order_setup',type:'single_line_text_field',value:marker};}
function ensureCollection(input) {
  const existing=before.collections.nodes.find(item=>item.handle===input.handle);
  if(existing) {
    if(existing.stamp?.value!==marker) throw new Error(`Refusing to overwrite an existing collection: ${input.handle}`);
    return existing;
  }
  const result=operation('create-collection',`mutation($input:CollectionInput!) { collectionCreate(input:$input) { collection { id title handle } userErrors { field message } } }`,{input:{...input,metafields:[stamp()]}},true);
  return created('collection',result.collectionCreate.collection);
}
function publish(id) {
  operation('publish-to-online-store',`mutation($id:ID!,$input:[PublicationInput!]!) { publishablePublish(id:$id,input:$input) { userErrors { field message } } }`,{id,input:[{publicationId:publication.id}]},true);
}
for(const [key,name,description] of [
  ['order_table_collection','Ordering table products','Select the supporting collection whose individual products appear as rows on this range product page.'],
  ['range_brand','Range brand collection','Select the customer-facing brand collection for this range product page.'],
]) {
  const existing=before.metafieldDefinitions.nodes.find(item=>item.key===key);
  if(existing && existing.type.name!=='collection_reference') throw new Error(`Conflicting metafield definition custom.${key}`);
  if(!existing) {
    const result=operation('create-definition',`mutation($definition:MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition:$definition) { createdDefinition { id } userErrors { field message } } }`,{definition:{name,namespace:'custom',key,description,type:'collection_reference',ownerType:'PRODUCT',access:{storefront:'PUBLIC_READ'}}},true);
    created('metafield definition',result.metafieldDefinitionCreate.createdDefinition);
  }
}
for(const range of ranges) {
  const image=range.children.find(product=>product.featuredImage)?.featuredImage;
  const rows=ensureCollection({title:`Ordering rows - ${range.title}`,handle:`ordering-rows-${range.key}`,sortOrder:'ALPHA_ASC',ruleSet:{appliedDisjunctively:false,rules:[{column:'TAG',relation:'EQUALS',condition:range.tag}]}});
  publish(rows.id);
  let product=before.products.nodes.find(item=>item.handle===range.handle);
  if(product && (!product.tags.includes(marker) || product.table?.value!==rows.id)) throw new Error(`Refusing to overwrite an existing product: ${range.handle}`);
  if(!product) {
    const input={title:range.title,handle:range.handle,vendor:range.brand,productType:'Range ordering page',status:'DRAFT',templateSuffix:'range-order',descriptionHtml:`<p>${range.description}</p>`,tags:[marker,'carpe-range-display'],metafields:[{namespace:'custom',key:'order_table_collection',type:'collection_reference',value:rows.id},{namespace:'seo',key:'hidden',type:'number_integer',value:'1'}]};
    const media=image?[{originalSource:image.url,mediaContentType:'IMAGE',alt:range.title}]:[];
    const result=operation('create-range-product',`mutation($product:ProductCreateInput!,$media:[CreateMediaInput!]) { productCreate(product:$product,media:$media) { product { id title handle variants(first:1) { nodes { id } } } userErrors { field message } } }`,{product:input,media},true);
    product=created('product',result.productCreate.product);
    // Only this newly created display variant is changed. Existing color inventory is untouched.
    const price=Math.min(...range.children.map(item=>Number(item.variants.nodes[0].price))).toFixed(2);
    const guarded=operation('guard-display-variant',`mutation($id:ID!,$variants:[ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId:$id,variants:$variants) { productVariants { id inventoryQuantity inventoryPolicy inventoryItem { tracked } } userErrors { field message } } }`,{id:product.id,variants:[{id:product.variants.nodes[0].id,price,inventoryPolicy:'DENY',inventoryItem:{tracked:true}}]},true);
    const variant=guarded.productVariantsBulkUpdate.productVariants[0];
    if(!variant.inventoryItem.tracked || variant.inventoryPolicy!=='DENY' || variant.inventoryQuantity!==0) throw new Error('Display variant must remain unpurchasable');
  } else {
    const variant=product.variants.nodes[0];
    if(!variant.inventoryItem.tracked || variant.inventoryPolicy!=='DENY' || variant.inventoryQuantity!==0) throw new Error(`Unsafe display variant on ${range.handle}; review manually`);
  }
  const brand=ensureCollection({title:range.brand,handle:range.brandHandle,templateSuffix:'product-ranges',descriptionHtml:`<p>Explore ${range.brand} product ranges and choose individual colors on each product page.</p>`,products:[product.id],...(image?{image:{src:image.url,altText:range.brand}}:{})});
  operation('link-brand',`mutation($metafields:[MetafieldsSetInput!]!) { metafieldsSet(metafields:$metafields) { userErrors { field message } } }`,{metafields:[{ownerId:product.id,namespace:'custom',key:'range_brand',type:'collection_reference',value:brand.id}]},true);
  operation('activate-range',`mutation($product:ProductUpdateInput!) { productUpdate(product:$product) { product { id } userErrors { field message } } }`,{product:{id:product.id,status:'ACTIVE'}},true);
  publish(product.id);publish(brand.id);
  state.ranges.push({key:range.key,tag:range.tag,count:range.count,title:range.title,productId:product.id,productHandle:product.handle,displayVariantId:product.variants.nodes[0].id,brandId:brand.id,brandHandle:brand.handle,rowsId:rows.id,rowsHandle:rows.handle});save();
  console.log(`Ready: ${range.brand} collection -> ${range.title} product -> ${range.count} unchanged color products`);
}
const manufacturers=ensureCollection({title:'See All Manufacturers',handle:'see-all-manufacturers',templateSuffix:'product-ranges',descriptionHtml:'<p>Explore the COPIC, OLO and Posca sample ranges. Open a product range to choose your colors and quantities.</p>',products:state.ranges.map(range=>range.productId)});
publish(manufacturers.id);
state.manufacturers=manufacturers;
const menuHandle='carpe-range-preview';
const menuTitle='Carpediem - sample range navigation';
const existingMenu=before.menus.nodes.find(menu=>menu.handle===menuHandle);
const items=[{title:'Home',type:'FRONTPAGE',url:'/',items:[]},{title:'SEE ALL MANUFACTURERS',type:'COLLECTION',resourceId:manufacturers.id,items:state.ranges.map(range=>({title:ranges.find(item=>item.key===range.key).brand,type:'COLLECTION',resourceId:range.brandId,items:[{title:range.title,type:'PRODUCT',resourceId:range.productId,items:[]}]}))}];
const contact=before.menus.nodes.find(menu=>menu.handle==='main-menu')?.items.find(item=>item.url==='/pages/contact');
if(contact) items.push({title:contact.title,type:contact.type,resourceId:contact.resourceId,url:contact.url,items:[]});
if(existingMenu) {
  if(existingMenu.title!==menuTitle) throw new Error('Conflicting preview menu; refusing overwrite');
  state.menu=existingMenu;
} else {
  const result=operation('create-preview-menu',`mutation($title:String!,$handle:String!,$items:[MenuItemCreateInput!]!) { menuCreate(title:$title,handle:$handle,items:$items) { menu { id title handle items { title type url resourceId items { title type url resourceId items { title type url resourceId } } } } userErrors { field message } } }`,{title:menuTitle,handle:menuHandle,items},true);
  state.menu=created('menu',result.menuCreate.menu);
}
save();
const after=operation('after',inspect);
for(const child of ranges.flatMap(range=>range.children)) {
  const current=after.products.nodes.find(product=>product.id===child.id);
  if(JSON.stringify(current)!==JSON.stringify(child)) throw new Error(`Color product changed during setup: ${child.handle}`);
}
for(const menu of before.menus.nodes.filter(menu=>menu.handle!==menuHandle)) {
  if(JSON.stringify(after.menus.nodes.find(item=>item.id===menu.id))!==JSON.stringify(menu)) throw new Error(`Existing menu changed: ${menu.handle}`);
}
console.log('VERIFIED: all 100 original products and existing menus unchanged. Created only sample-range resources. Theme not published.');
console.log('State saved: '+path.join(artifactDir,'range-setup-state.json'));
