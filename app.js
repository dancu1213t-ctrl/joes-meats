const products=SITE_DATA.products;
const catalog=Object.fromEntries(SITE_DATA.categories.map(c=>[c.name,[]]));
const features=Object.fromEntries(SITE_DATA.categories.map(c=>[c.name,['',c.title,'',c.slides[0].src]]));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active='Beef',page=1,cart={};
const $=s=>document.querySelector(s),dialog=$('#list-dialog');
const money=n=>'$'+n.toFixed(2);
const quantity=id=>cart[id]||0;
try{
 const stored=JSON.parse(localStorage.getItem('joes-cart')||'null');
 if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
  for(const p of products)if(CartMath.validQuantity(stored[p.id]))cart[p.id]=stored[p.id];
 }else{
  const old=JSON.parse(localStorage.getItem('joes-list')||'[]');
  if(Array.isArray(old))for(const id of old)if(products.some(p=>p.id===id))cart[id]=1;
 }
 const store=localStorage.getItem('joes-store');if(SITE_DATA.stores.some(s=>s.whatsapp===store))$('#store').value=store;
}catch{}
function cartItems(){return products.filter(p=>quantity(p.id)>0).map(p=>({...p,quantity:quantity(p.id)}));}
function persist(){try{localStorage.setItem('joes-cart',JSON.stringify(cart));localStorage.setItem('joes-store',$('#store').value);}catch{}const count=cartItems().reduce((n,p)=>n+p.quantity,0);document.querySelectorAll('.count').forEach(e=>e.textContent=count.toLocaleString());}
function render(){const query=$('#search').value.trim().toLowerCase();let items=products.filter(p=>(query||p.category===active)&&(!query||p.name.toLowerCase().includes(query)||p.category.toLowerCase().includes(query)));const sort=$('#sort').value;if(sort==='low')items.sort((a,b)=>a.price-b.price);if(sort==='high')items.sort((a,b)=>b.price-a.price);if(sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name));$('.filters').innerHTML=Object.keys(catalog).map(c=>`<button class="filter" aria-pressed="${!query&&c===active}" data-category="${c}">${c}</button>`).join('');$('#result-count').textContent=`${items.length} ${items.length===1?'cut':'cuts'} ${query?'across all categories':'in '+active.toLowerCase()}`;const totalPages=Math.max(1,Math.ceil(items.length/6));page=Math.min(page,totalPages);$('#pagination').innerHTML=totalPages>1?`<span>Page ${page} of ${totalPages}</span><div><button data-page='${page-1}' ${page===1?'disabled':''} aria-label='Previous product page'>← Previous</button><button data-page='${page+1}' ${page===totalPages?'disabled':''} aria-label='Next product page'>Next →</button></div>`:'';$('#products').innerHTML=items.length?items.slice((page-1)*6,page*6).map(p=>`<article class="product"><div class="product-body"><h3>${esc(p.name)}</h3><p>${money(p.price)}</p></div><button class="add ${quantity(p.id)?'saved':''}" data-add="${p.id}" aria-label="Add ${esc(p.name)} to cart">+</button>${quantity(p.id)?`<span class="in-cart">${quantity(p.id)} in cart</span>`:''}</article>`).join(''):'<div class="empty-results"><h3>No cuts found.</h3><p>Try “steak”, “lamb” or “bacon”.</p><button class="button primary" id="clear-search">Clear search</button></div>';const f=features[active];$('#category-caption').textContent=f[0];$('#category-title').textContent=f[1];$('#category-description').textContent=f[2];const categoryImage=$('#category-image');if(categoryImage)categoryImage.src=f[3];window.dispatchEvent(new CustomEvent('categorychange',{detail:active}));persist();}
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}
function renderList(){
 const items=cartItems();
 $('#list-items').innerHTML=items.length?items.map(p=>`<div class="cart-row"><div class="cart-product"><div><h3>${esc(p.name)}</h3><p>${money(p.price)} × ${p.quantity} <span>· listed price</span></p></div><strong>${money(CartMath.lineCents(p)/100)}</strong></div><div class="cart-row-actions"><div class="quantity-control"><button data-quantity="${p.id}" data-delta="-1" aria-label="Decrease ${esc(p.name)} quantity" ${p.quantity===1?'disabled':''}>−</button><input type="number" min="1" max="${CartMath.maxQuantity}" step="1" inputmode="numeric" value="${p.quantity}" data-quantity-input="${p.id}" aria-label="${esc(p.name)} quantity"><button data-quantity="${p.id}" data-delta="1" aria-label="Increase ${esc(p.name)} quantity" ${p.quantity===CartMath.maxQuantity?'disabled':''}>+</button></div><button class="remove" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button></div></div>`).join(''):'<div class="empty-list"><h3>What’s cooking?</h3><p>Add your favourite cuts to start your order.</p><button class="button primary" id="browse-cuts">Explore our cuts ↗</button></div>';
 $('#enquiry-fields').hidden=!items.length;
 $('#cart-summary').hidden=!items.length;
 updateEnquiry();
}
function updateEnquiry(){
 const items=cartItems(),count=items.reduce((n,p)=>n+p.quantity,0),total=CartMath.totalCents(items);
 $('#cart-total').textContent=money(total/100);
 $('#cart-count').textContent=count.toLocaleString()+' total quantity · '+items.length+' '+(items.length===1?'cut':'cuts');
 const phone=$('#store').value,branch=SITE_DATA.stores.find(s=>s.whatsapp===phone)||SITE_DATA.stores[0],store=branch.name;
 $('#store-destination').textContent=store+' · +'+phone;
 $('#send-enquiry').textContent='Send to '+store+' on WhatsApp ↗';
 $('#send-enquiry').href='https://wa.me/'+phone+'?text='+encodeURIComponent(CartMath.message(items,store,$('#notes').value.trim(),branch.directions));
 persist();
}
function changeQuantity(id,value){
 if(!CartMath.validQuantity(value)){toast('Please enter a whole quantity of 1 or more.');renderList();return;}
 cart[id]=value;render();renderList();
}
document.addEventListener('input',e=>{
 const input=e.target.closest('[data-quantity-input]');if(!input)return;
 const value=Number(input.value),id=input.dataset.quantityInput;if(!CartMath.validQuantity(value))return;
 cart[id]=value;const p=products.find(p=>p.id===id),row=input.closest('.cart-row');
 row.querySelector('.cart-product p').textContent=money(p.price)+' × '+value+' · listed price';
 row.querySelector('.cart-product strong').textContent=money(CartMath.lineCents({...p,quantity:value})/100);
 row.querySelector('[data-delta="-1"]').disabled=value===1;row.querySelector('[data-delta="1"]').disabled=value===CartMath.maxQuantity;
 render();updateEnquiry();
});
document.addEventListener('change',e=>{const input=e.target.closest('[data-quantity-input]');if(input){const id=input.dataset.quantityInput;changeQuantity(id,Number(input.value));document.querySelector(`[data-quantity-input="${id}"]`)?.focus({preventScroll:true});}});
document.addEventListener('click',e=>{
 const category=e.target.closest('[data-category]');if(category){active=category.dataset.category;page=1;$('#search').value='';render();document.querySelector(`[data-category="${active}"]`).focus();}
 const add=e.target.closest('[data-add]');if(add){const id=add.dataset.add,p=products.find(p=>p.id===id);if(quantity(id)<CartMath.maxQuantity){cart[id]=quantity(id)+1;toast(p.name+' · '+quantity(id)+' in cart');render();document.querySelector(`[data-add="${id}"]`)?.focus({preventScroll:true});}}
 if(e.target.closest('[data-open-list]')){renderList();dialog.showModal();}
 if(e.target.closest('.close'))dialog.close();
 const step=e.target.closest('[data-quantity]');if(step){const id=step.dataset.quantity,delta=Number(step.dataset.delta);changeQuantity(id,quantity(id)+delta);const next=document.querySelector(`[data-quantity="${id}"][data-delta="${delta}"]`);if(next&&!next.disabled)next.focus({preventScroll:true});else document.querySelector(`[data-quantity-input="${id}"]`)?.focus({preventScroll:true});}
 const remove=e.target.closest('[data-remove]');if(remove){delete cart[remove.dataset.remove];render();renderList();const next=$('#list-items .remove');if(next)next.focus({preventScroll:true});else $('#browse-cuts').focus();}
 if(e.target.closest('#browse-cuts')){dialog.close();history.pushState(null,'','#cuts');showView();$('#search').focus({preventScroll:true});}
 if(e.target.closest('#clear-search')){$('#search').value='';page=1;render();$('#search').focus();}
});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('#search').addEventListener('input',()=>{page=1;render();});$('#sort').addEventListener('change',()=>{page=1;render();});$('#notes').addEventListener('input',updateEnquiry);$('#store').addEventListener('change',updateEnquiry);
$('.menu-button').addEventListener('click',()=>{const open=$('#navigation').classList.toggle('open');$('.menu-button').setAttribute('aria-expanded',open);$('.menu-button').textContent=open?'×':'☰';});
$('#navigation').addEventListener('click',e=>{if(e.target.closest('a')){$('#navigation').classList.remove('open');$('.menu-button').setAttribute('aria-expanded','false');$('.menu-button').textContent='☰';}});
$('#year').textContent=new Date().getFullYear();render();

const views={home:'.hero',cuts:'#cuts',story:'#story',locations:'#locations'};
function showView(focus=false){
 const requested=location.hash.slice(1)||'home';
 if(requested==='main'){document.querySelector('#main').focus();return;}
 const view=Object.hasOwn(views,requested)?requested:'home';
 document.body.dataset.view=view;
 document.querySelectorAll('main > *').forEach(el=>{el.hidden=!el.matches(views[view]);});
 document.querySelectorAll('#navigation a').forEach(a=>{if(a.hash==='#'+view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.title=({home:'Good food starts here',cuts:'Our cuts',story:'Our story',locations:'Stores & contact'})[view]+' — Joe’s Meats';
 window.scrollTo({top:0,behavior:'instant'});
 if(focus){const heading=document.querySelector(views[view]+' h1, '+views[view]+' h2');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});}
}
window.addEventListener('hashchange',()=>showView(true));window.addEventListener('popstate',()=>showView(true));
document.addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(button){page=Number(button.dataset.page);render();document.querySelector('#products h3')?.setAttribute('tabindex','-1');document.querySelector('#products h3')?.focus({preventScroll:true});}const link=e.target.closest('a[href^="#"]');if(link&&link.hash!=='#main'){e.preventDefault();if(link.hash!==location.hash){history.pushState(null,'',link.hash);}showView(true);}});
showView();

// WhatsApp does not report message delivery to this website. Reset on handoff.
$('#send-enquiry').addEventListener('click',()=>{
 if(!cartItems().length)return;
 // Let the browser open the current, fully populated WhatsApp link first.
 setTimeout(()=>{
  cart={};
  $('#notes').value='';
  render();
  renderList();
  dialog.close();
  toast('Cart cleared. Review and send your order in WhatsApp.');
 },0);
});
