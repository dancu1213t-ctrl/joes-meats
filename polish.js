/* Optional visual feedback only. No pricing, quantities or order routing here. */
(()=>{
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const count=document.querySelector('.count');
 let lastCount=count.textContent;
 new MutationObserver(()=>{if(count.textContent===lastCount)return;lastCount=count.textContent;if(!reduced())count.animate([{transform:'scale(1)'},{transform:'scale(1.23)',offset:.4},{transform:'scale(1)'}],{duration:260,easing:'ease-out'});}).observe(count,{childList:true,characterData:true,subtree:true});
 document.addEventListener('click',event=>{
  const shortcut=event.target.closest('[data-browse-category]');
  if(shortcut){active=shortcut.dataset.browseCategory;page=1;document.querySelector('#search').value='';render();}
  const add=event.target.closest('[data-add]');
  if(add&&!reduced()){
   const current=document.querySelector(`[data-add="${add.dataset.add}"]`);
   current?.animate([{transform:'scale(.82)'},{transform:'scale(1.14)',offset:.55},{transform:'scale(1)'}],{duration:260,easing:'ease-out'});
  }
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.querySelector('#navigation').classList.contains('open')){
   document.querySelector('#navigation').classList.remove('open');
   const button=document.querySelector('.menu-button');button.setAttribute('aria-expanded','false');button.textContent='☰';button.focus();
  }
 });
})();
