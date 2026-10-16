/** Scoped, resumable setup. Only adds homepage flags to the three approved table display products.
 * node scripts/setup-homepage-arrivals.cjs <shopify-cli-run.js> <audit-directory> [--apply]
 * Without --apply: read-only audit. Never reads or stores credentials.
 */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const [cli,audit,apply]=process.argv.slice(2);
if(!cli||!audit)throw new Error('CLI path and audit directory required.');
fs.mkdirSync(audit,{recursive:true});
const store='x1j8t7-2r.myshopify.com',marker='carpe-home-arrivals-v1',key='show_in_new_arrivals',handle='new-arrivals-table-products';
const targets=['copic-sketch-markers','olo-premium-markers-brush','posca-pc-5m-medium'];
let sequence=0;
function operation(label,query,variables={},mutation=false){
 if(mutation&&apply!=='--apply')throw new Error('Mutations require --apply.');
 const prefix=path.join(audit,`${String(++sequence).padStart(3,'0')}-${label}`);
 fs.writeFileSync(prefix+'.graphql',query);fs.writeFileSync(prefix+'.variables.json',JSON.stringify(variables,null,2));
 const args=[cli,'store','execute','--store',store,'--version','2026-10','--query-file',prefix+'.graphql','--variable-file',prefix+'.variables.json','--output-file',prefix+'.result.json','--json','--no-input'];
 if(mutation)args.push('--allow-mutations');
 try{execFileSync(process.execPath,args,{encoding:'utf8',stdio:'pipe',timeout:90000});}catch(error){throw new Error(`${label}: ${error.stdout||''}\n${error.stderr||error.message}`);}
 const result=JSON.parse(fs.readFileSync(prefix+'.result.json','utf8'));
 if(result.errors?.length)throw new Error(JSON.stringify(result.errors));
 for(const value of Object.values(result))if(value?.userErrors?.length)throw new Error(`${label}: ${JSON.stringify(value.userErrors)}`);
 return result;
}
const inspect=`query {
 products(first:250) { pageInfo { hasNextPage } nodes { id handle title status templateSuffix tags metafields(first:50) { nodes { namespace key type value } } variants(first:10) { nodes { id price sku barcode inventoryQuantity inventoryPolicy inventoryItem { id tracked } } } } }
 collections(first:100) { pageInfo { hasNextPage } nodes { id handle title templateSuffix sortOrder stamp:metafield(namespace:"custom",key:"order_setup") { value } ruleSet { appliedDisjunctively rules { column relation condition } } } }
 menus(first:50) { nodes { id handle title items { id title type url resourceId items { id title type url resourceId items { id title type url resourceId } } } } }
 metafieldDefinitions(first:100,ownerType:PRODUCT,namespace:"custom") { nodes { id key type { name } access { storefront } capabilities { smartCollectionCondition { enabled } } } }
 publications(first:20) { nodes { id name } }
}`;
const before=operation('before',inspect);
if(before.products.pageInfo.hasNextPage||before.collections.pageInfo.hasNextPage)throw new Error('Audit window exceeded; stop before writes.');
const displayProducts=targets.map(handle=>{
 const product=before.products.nodes.find(item=>item.handle===handle);
 const table=product?.metafields.nodes.find(item=>item.namespace==='custom'&&item.key==='order_table_collection');
 if(!product||product.templateSuffix!=='range-order'||product.status!=='ACTIVE'||!before.collections.nodes.some(item=>item.id===table?.value))throw new Error('Expected active table product missing: '+handle);
 return product;
});
console.log(`Audited ${before.products.nodes.length} products; three eligible table pages verified.`);
if(apply!=='--apply')process.exit(0);
let definition=before.metafieldDefinitions.nodes.find(item=>item.key===key);
if(definition&&(definition.type.name!=='boolean'||definition.access.storefront!=='PUBLIC_READ'||!definition.capabilities.smartCollectionCondition.enabled))throw new Error('Conflicting existing homepage metafield definition; stop before changes.');
if(!definition){
 const result=operation('create-homepage-flag',`mutation($definition:MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition:$definition) { createdDefinition { id key } userErrors { field message } } }`,{definition:{name:'Show in new arrivals',namespace:'custom',key,type:'boolean',ownerType:'PRODUCT',pin:true,description:'Enable only on the main range-order product with an Ordering table products collection. Adds that table page to homepage New arrivals; leave off on individual colors, sizes and samples.',access:{storefront:'PUBLIC_READ'},capabilities:{smartCollectionCondition:{enabled:true}}}},true);
 definition=result.metafieldDefinitionCreate.createdDefinition;
}
operation('enable-three-table-pages',`mutation($metafields:[MetafieldsSetInput!]!) { metafieldsSet(metafields:$metafields) { metafields { id ownerType namespace key value } userErrors { field message } } }`,{metafields:displayProducts.map(product=>({ownerId:product.id,namespace:'custom',key,type:'boolean',value:'true'}))},true);
let collection=before.collections.nodes.find(item=>item.handle===handle);
if(collection&&(collection.stamp?.value!==marker||collection.templateSuffix!=='product-ranges'))throw new Error('Conflicting existing collection; refusing overwrite.');
if(!collection){
 const result=operation('create-new-arrivals',`mutation($input:CollectionInput!) { collectionCreate(input:$input) { collection { id handle title } userErrors { field message } } }`,{input:{title:'New arrivals',handle,templateSuffix:'product-ranges',sortOrder:'CREATED_DESC',descriptionHtml:'<p>Discover our latest product ranges. Open a range to choose individual items and quantities in its ordering table.</p>',metafields:[{namespace:'custom',key:'order_setup',type:'single_line_text_field',value:marker}],ruleSet:{appliedDisjunctively:false,rules:[{column:'PRODUCT_METAFIELD_DEFINITION',relation:'EQUALS',condition:'true',conditionObjectId:definition.id}]}}},true);
 collection=result.collectionCreate.collection;
}
const publication=before.publications.nodes.find(item=>item.name==='Online Store');if(!publication)throw new Error('Online Store publication unavailable.');
operation('publish-new-arrivals-collection',`mutation($id:ID!,$input:[PublicationInput!]!) { publishablePublish(id:$id,input:$input) { userErrors { field message } } }`,{id:collection.id,input:[{publicationId:publication.id}]},true);
const after=operation('after',inspect);
function comparable(product){const copy=JSON.parse(JSON.stringify(product));copy.metafields.nodes=copy.metafields.nodes.filter(field=>!(field.namespace==='custom'&&field.key===key));return copy;}
for(const product of before.products.nodes){
 const current=after.products.nodes.find(item=>item.id===product.id);
 if(targets.includes(product.handle)){
  if(JSON.stringify(comparable(current))!==JSON.stringify(comparable(product)))throw new Error('Unexpected change to table product: '+product.handle);
  if(current.metafields.nodes.find(field=>field.namespace==='custom'&&field.key===key)?.value!=='true')throw new Error('Homepage flag was not saved.');
 }else if(JSON.stringify(current)!==JSON.stringify(product))throw new Error('Unrelated product changed: '+product.handle);
}
for(const original of before.collections.nodes)if(JSON.stringify(after.collections.nodes.find(item=>item.id===original.id))!==JSON.stringify(original))throw new Error('Existing collection changed: '+original.handle);
if(JSON.stringify(before.menus)!==JSON.stringify(after.menus))throw new Error('An existing menu changed.');
let membership;
for(let attempt=0;attempt<5;attempt++){
 membership=operation('verify-smart-collection',`query($id:ID!) { collection(id:$id) { id handle title products(first:100) { pageInfo { hasNextPage } nodes { id handle title } } } }`,{id:collection.id});
 const actual=membership.collection.products.nodes.map(item=>item.id).sort();
 if(JSON.stringify(actual)===JSON.stringify(displayProducts.map(item=>item.id).sort()))break;
 if(attempt===4)throw new Error('Automatic collection membership still indexing or contains unexpected products; inspect audit before continuing.');
}
const state={store,marker,definition:{id:definition.id,namespace:'custom',key,name:'Show in new arrivals'},collection:{id:collection.id,handle,title:'New arrivals'},enabledProducts:displayProducts.map(product=>({id:product.id,handle:product.handle,title:product.title})),verifiedMembers:membership.collection.products.nodes};
fs.writeFileSync(path.join(audit,'homepage-arrivals-state.json'),JSON.stringify(state,null,2));
console.log('VERIFIED: New arrivals contains only the three table pages. Samples and individual items remain unflagged. Existing product data, stock, collections and menus preserved. No theme published.');
console.log('State: '+path.join(audit,'homepage-arrivals-state.json'));
