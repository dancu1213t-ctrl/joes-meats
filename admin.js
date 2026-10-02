const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,tab='products',dirty=false,configured=true,productCategory='All',search='',categoryIndex=0,undoState=null,noticeTimer;
const clone=v=>JSON.parse(JSON.stringify(v));
function get(path){return path.split('.').reduce((o,k)=>o[k],data);}
function put(path,value){const parts=path.split('.'),key=parts.pop();parts.reduce((o,k)=>o[k],data)[key]=value;markDirty();}
function markDirty(){dirty=true;$('#save').disabled=false;$('#save-state').textContent='Unsaved changes';$('#save-state').classList.remove('status-error');}
function notice(text,undo=false){$('#admin-notice span').textContent=text;$('#admin-notice').hidden=false;$('#undo').hidden=!undo;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#admin-notice').hidden=true,7000);}
let browserDemo=false;
const demoKey='joes-demo-site-v1',demoSession='joes-demo-login-v1';
async function demoApi(path,body){
 if(path==='/api/admin/status')return {configured:true,authenticated:sessionStorage.getItem(demoSession)==='yes'};
 if(path==='/api/admin/login'){
  if(body.password!=='joesmeat2026')throw new Error('Incorrect password.');
  sessionStorage.setItem(demoSession,'yes');return {ok:true};
 }
 if(sessionStorage.getItem(demoSession)!=='yes')throw new Error('Please sign in again.');
 if(path==='/api/admin/logout'){sessionStorage.removeItem(demoSession);return {ok:true};}
 if(path==='/api/site'){const saved=localStorage.getItem(demoKey);return saved?JSON.parse(saved):await (await fetch('site-defaults.json')).json();}
 if(path==='/api/admin/upload'){
  const raw=atob(body.data),mime=raw.startsWith('\x89PNG')?'image/png':raw.startsWith('\xff\xd8\xff')?'image/jpeg':raw.startsWith('RIFF')&&raw.slice(8,12)==='WEBP'?'image/webp':null;
  if(!mime)throw new Error('Use a PNG, JPG or WebP image.');
  if(raw.length>1024*1024)throw new Error('For this browser demo, use an image under 1 MB.');
  return {src:'data:'+mime+';base64,'+body.data};
 }
 if(path==='/api/admin/site'){
  const current=await demoApi('/api/site');
  if(current.revision!==body.revision)throw new Error('Another tab saved changes. Export your draft, then reload.');
  if(body.products.some(p=>!p.name.trim()||!Number.isFinite(p.price)||p.price<=0||p.price>10000||Math.abs(p.price*100-Math.round(p.price*100))>.0001))throw new Error('Enter product names and valid prices with up to two decimals.');
  const saved={...body,revision:current.revision+1};
  try{localStorage.setItem(demoKey,JSON.stringify(saved));}catch(e){throw new Error('Browser storage is full or unavailable. Use smaller images, or export your draft.');}
  return saved;
 }
 throw new Error('This action is not available in the browser demo.');
}
async function api(path,body){
 if(browserDemo)return demoApi(path,body);
 const options=body?{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'JoesAdmin'},body:JSON.stringify(body)}:{cache:'no-store'};
 const r=await fetch(path,options);
 if(path==='/api/admin/status'&&(!r.ok||!r.headers.get('content-type')?.includes('application/json'))){
  browserDemo=true;
  $('#password').minLength=1;
  $('#auth-help').textContent='Joes Meats LTD.';
  $('.nav-note').textContent='Demo only: saved edits affect this browser. Reload the website to preview. Clearing browser data removes edits. Export a backup to keep a copy.';
  const banner=document.createElement('p');banner.textContent='Browser demo — this password is not secure access control. Changes stay in this browser only.';banner.style.cssText='padding:12px 18px;background:#fff4dc;color:#654816;border-radius:10px';document.querySelector('main').prepend(banner);
  return demoApi(path,body);
 }
 const v=await r.json();if(!r.ok)throw new Error(v.error||'Request failed.');return v;
}
function field(label,path,type='text',extra=''){const value=get(path);return `<div class="field ${extra}"><label>${esc(label)}${type==='textarea'?`<textarea data-field="${path}">${esc(value)}</textarea>`:`<input type="${type}" data-field="${path}" value="${esc(value)}" ${type==='number'?'min="0.01" max="10000" step="0.01"':''}>`}</label></div>`;}
function imageCard(path,index=null){const object=get(path),single=typeof object==='string',src=single?object:object.src;const srcPath=single?path:path+'.src';return `<div class="image-card"><img src="${esc(src)}" alt="Image preview"><label>Image URL<input data-field="${srcPath}" value="${esc(src)}" placeholder="https://… or upload an image"></label><label>Upload image<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${srcPath}"></label>${single?'':`<label>Image description<input data-field="${path}.alt" value="${esc(object.alt)}" maxlength="200"></label>`}${index===null?'':`<div class="image-actions"><span>Slide ${index+1}</span><div><button data-move="${path}" data-direction="-1" ${index===0?'disabled':''} aria-label="Move slide ${index+1} earlier">↑</button><button data-move="${path}" data-direction="1" ${index===get(path.split('.').slice(0,-1).join('.')).length-1?'disabled':''} aria-label="Move slide ${index+1} later">↓</button><button class="delete-button" data-delete-slide="${path}">Remove</button></div></div>`}</div>`;}
function heading(title,description,button=''){return `<div class="editor-heading"><div><h2>${title}</h2><p>${description}</p></div>${button}</div>`;}
function render(){
 $('#summary').textContent=data.products.length+' products · '+data.categories.length+' categories · 2 stores';
 document.querySelectorAll('[data-tab]').forEach(b=>{b.removeAttribute('aria-current');if(b.dataset.tab===tab)b.setAttribute('aria-current','page');});
 if(tab==='products'){
  const items=data.products.map((p,i)=>({...p,index:i})).filter(p=>(productCategory==='All'||p.category===productCategory)&&p.name.toLowerCase().includes(search.toLowerCase()));
  $('#editor').innerHTML=heading('Your product counter.','Edit existing prices or add a new cut. All prices are in BZD.','<button class="primary-button" id="add-product">+ Add product</button>')+`<div class="product-toolbar"><input id="product-search" aria-label="Search products" placeholder="Search your products…" value="${esc(search)}"><select id="product-category" aria-label="Filter category">${['All',...data.categories.map(c=>c.name)].map(c=>`<option ${c===productCategory?'selected':''}>${esc(c)}</option>`).join('')}</select></div><table class="product-table"><thead><tr><th>Product</th><th>Category</th><th>Price · BZD</th><th></th></tr></thead><tbody>${items.map(p=>`<tr><td><input aria-label="${esc(p.name)} name" data-field="products.${p.index}.name" value="${esc(p.name)}" maxlength="100"></td><td><select aria-label="${esc(p.name)} category" data-field="products.${p.index}.category">${data.categories.map(c=>`<option ${p.category===c.name?'selected':''}>${esc(c.name)}</option>`).join('')}</select></td><td><input aria-label="${esc(p.name)} price" type="number" min="0.01" max="10000" step="0.01" data-field="products.${p.index}.price" value="${p.price}"></td><td><button class="delete-button" data-delete-product="${p.index}" aria-label="Remove ${esc(p.name)}">×</button></td></tr>`).join('')}</tbody></table>${items.length?'':'<div class="empty-state">No products match. Try another category or add a product.</div>'}`;
 }else if(tab==='home'){
  $('#editor').innerHTML=heading('The first impression.','Upload photographs, write image descriptions, and arrange your homepage slideshow.', '<button class="primary-button" data-add-slide="homeSlides">+ Add slide</button>')+`<div class="image-grid">${data.homeSlides.map((s,i)=>imageCard('homeSlides.'+i,i)).join('')}</div><p class="hint">JPG, PNG or WebP · up to 6 MB per image · 1–12 slides. Landscape photos work best.</p>`;
 }else if(tab==='categories'){
  const path='categories.'+categoryIndex+'.slides';
  $('#editor').innerHTML=heading('A little inspiration.','Manage the image slider beside each product category.',`<button class="primary-button" data-add-slide="${path}">+ Add slide</button>`)+`<select id="image-category" class="category-select" aria-label="Image category">${data.categories.map((c,i)=>`<option value="${i}" ${i===categoryIndex?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`+field('Side image heading','categories.'+categoryIndex+'.title','textarea')+`<div class="image-grid">${get(path).map((s,i)=>imageCard(path+'.'+i,i)).join('')}</div><p class="hint">Images are serving inspiration. Product prices are edited under Products.</p>`;
 }else if(tab==='content'){
  $('#editor').innerHTML=heading('Your words. Your brand.','Update the main website copy and brand images.')+`<div class="form-grid">${field('Top announcement','copy.announcement','text','full-width')}${field('Homepage eyebrow','copy.homeEyebrow','text','full-width')}${field('Homepage headline — one line per row','copy.homeTitle','textarea')}${field('Homepage description','copy.homeDescription','textarea')}${field('About headline','copy.storyTitle','textarea')}${field('About text — blank lines separate paragraphs','copy.storyText','textarea')}</div><hr class="section-divider"><div class="image-grid"><div><h3>Brand logo</h3>${imageCard('copy.logo')}</div><div><h3>About photograph</h3>${imageCard('copy.storyImage')}</div></div>`;
 }else{
  $('#editor').innerHTML=heading('Keep customers connected.','Store details also update the WhatsApp destination and pickup link in order messages.')+`<div class="form-grid">${field('Monday–Saturday hours','copy.weekdays')}${field('Sunday hours','copy.sunday')}${field('Facebook URL','copy.facebook','url')}${field('Instagram URL','copy.instagram','url')}${field('Privacy policy URL','copy.privacy','url','full-width')}</div>`+data.stores.map((s,i)=>`<div class="store-form"><h3>${esc(s.name)}</h3><div class="form-grid">${field('Store name',`stores.${i}.name`)}${field('Phone — country code + digits',`stores.${i}.phone`)}${field('WhatsApp — country code + digits',`stores.${i}.whatsapp`)}${field('Email',`stores.${i}.email`,'email')}${field('Address',`stores.${i}.address`,'textarea','full-width')}${field('Directions / pickup link',`stores.${i}.directions`,'url','full-width')}</div><div class="single-image"><h3>Store card background</h3>${imageCard('stores.'+i+'.image')}</div></div>`).join('');
 }
}
async function start(){try{const status=await api('/api/admin/status');configured=status.configured;if(status.authenticated){await load();return;}$('#auth-title').textContent=configured?'Welcome back.':'Set up your admin.';$('#auth-help').textContent=configured?(browserDemo?'Browser-only demo. Changes stay in this browser and are not published.':'Sign in to manage products, images and store details.'):'Choose your own password (at least 12 characters). This local admin account controls your website.';$('#auth-submit').textContent=configured?'Sign in':'Create admin';$('#password').autocomplete=configured?'current-password':'new-password';}catch(e){$('#auth-message').textContent='Start the website with python server.py to use the admin area. '+e.message;}}
async function load(){data=await api('/api/site');dirty=false;$('#auth-panel').hidden=true;$('#dashboard').hidden=false;$('#save').disabled=true;render();}
$('#auth-form').addEventListener('submit',async e=>{e.preventDefault();$('#auth-submit').disabled=true;try{await api('/api/admin/'+(configured?'login':'setup'),{password:$('#password').value});$('#password').value='';await load();}catch(e){$('#auth-message').textContent=e.message;}finally{$('#auth-submit').disabled=false;}});
document.addEventListener('input',e=>{const field=e.target.dataset.field;if(field)put(field,e.target.type==='number'?Number(e.target.value):e.target.value);if(e.target.id==='product-search'){const position=e.target.selectionStart;search=e.target.value;render();$('#product-search').focus();$('#product-search').setSelectionRange(position,position);}});
document.addEventListener('change',async e=>{
 if(e.target.dataset.field){put(e.target.dataset.field,e.target.type==='number'?Number(e.target.value):e.target.value);if(e.target.closest('.image-card'))e.target.closest('.image-card').querySelector('img').src=get(e.target.dataset.field.replace(/\.alt$/,'.src'));}
 if(e.target.id==='product-category'){productCategory=e.target.value;render();}if(e.target.id==='image-category'){categoryIndex=Number(e.target.value);render();}
 if(e.target.dataset.upload){const file=e.target.files[0];if(!file)return;if(file.size>6*1024*1024){notice('Please use an image under 6 MB.');return;}const input=e.target;input.disabled=true;try{const bytes=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});const result=await api('/api/admin/upload',{data:bytes});put(input.dataset.upload,result.src);render();notice('Image uploaded. Save changes to use it on the website.');}catch(e){notice(e.message);}finally{input.disabled=false;}}
});
document.addEventListener('click',e=>{
 const section=e.target.closest('[data-tab]');if(section){tab=section.dataset.tab;render();}
 if(e.target.id==='add-product'){undoState=clone(data);data.products.push({id:'product-'+crypto.randomUUID(),name:'New product',price:1,category:productCategory==='All'?data.categories[0].name:productCategory});search='';markDirty();render();const inputs=$$('#editor input[data-field$=".name"]');const input=inputs[inputs.length-1];input?.focus();input?.select();}
 const remove=e.target.closest('[data-delete-product]');if(remove){undoState=clone(data);data.products.splice(Number(remove.dataset.deleteProduct),1);markDirty();render();notice('Product removed from draft.',true);}
 const add=e.target.closest('[data-add-slide]');if(add){const list=get(add.dataset.addSlide);if(list.length>=12){notice('A slider can have up to 12 images.');return;}list.push({src:'assets/hero.jpg',alt:'New meat photograph'});markDirty();render();}
 const del=e.target.closest('[data-delete-slide]');if(del){const parts=del.dataset.deleteSlide.split('.'),index=Number(parts.pop()),list=get(parts.join('.'));if(list.length===1){notice('Keep at least one image in each slider.');return;}undoState=clone(data);list.splice(index,1);markDirty();render();notice('Slide removed from draft.',true);}
 const move=e.target.closest('[data-move]');if(move){const parts=move.dataset.move.split('.'),index=Number(parts.pop()),list=get(parts.join('.')),next=index+Number(move.dataset.direction);if(next>=0&&next<list.length){[list[index],list[next]]=[list[next],list[index]];markDirty();render();}}
});
const $$=s=>[...document.querySelectorAll(s)];
$('#undo').onclick=()=>{if(undoState){data=undoState;undoState=null;markDirty();render();notice('Change restored.');}};
$('#save').onclick=async()=>{const invalid=$$('#editor input, #editor textarea').find(el=>!el.checkValidity());if(invalid){invalid.reportValidity();return;}$('#save').disabled=true;$('#save-state').textContent='Saving…';try{data=await api('/api/admin/site',data);dirty=false;undoState=null;$('#save-state').textContent='All changes saved';render();notice(browserDemo?'Saved in this browser. Reload the website to preview.':'Saved. Your website is updated.');}catch(e){$('#save-state').textContent=e.message;$('#save-state').classList.add('status-error');$('#save').disabled=false;}};
$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='joes-meats-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#logout').onclick=async()=>{if(dirty&&!confirm('Leave without saving your draft?'))return;try{await api('/api/admin/logout',{});dirty=false;location.reload();}catch(e){notice(e.message);}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
start();
