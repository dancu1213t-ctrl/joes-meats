(()=>{
 function slider(host,label){
  host.classList.add('photo-slider');host.setAttribute('role','region');host.setAttribute('aria-roledescription','carousel');host.setAttribute('aria-label',label);
  const old=host.querySelector(':scope > img');if(old)old.remove();
  const layer=document.createElement('div');layer.className='slider-images';host.prepend(layer);
  const controls=document.createElement('div');controls.className='slider-controls';
  host.append(controls);
  let list=[],index=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,hover=false,focus=false;
  function show(next){index=(next+list.length)%list.length;layer.querySelectorAll('img').forEach((img,i)=>{img.classList.toggle('current',i===index);img.setAttribute('aria-hidden',i!==index);});controls.querySelectorAll('button').forEach((dot,i)=>{dot.setAttribute('aria-pressed',i===index);});}
  controls.addEventListener('click',e=>{const dot=e.target.closest('[data-slide]');if(dot){paused=true;show(Number(dot.dataset.slide));}});
  host.addEventListener('mouseenter',()=>hover=true);host.addEventListener('mouseleave',()=>hover=false);host.addEventListener('focusin',()=>focus=true);host.addEventListener('focusout',e=>focus=host.contains(e.relatedTarget));
  controls.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();paused=true;show(index+(e.key==='ArrowRight'?1:-1));controls.children[index].focus();}});
  let start=null;host.addEventListener('touchstart',e=>start=e.changedTouches[0].clientX,{passive:true});host.addEventListener('touchend',e=>{if(start!==null){const delta=e.changedTouches[0].clientX-start;if(Math.abs(delta)>50)show(index+(delta<0?1:-1));start=null;}},{passive:true});
  setInterval(()=>{if(list.length>1&&!paused&&!hover&&!focus&&!document.hidden&&host.getBoundingClientRect().width>0)show(index+1);},5500);
  return slides=>{list=slides;layer.replaceChildren();controls.replaceChildren();list.forEach((slide,i)=>{const dot=document.createElement('button');dot.type='button';dot.className='slide-dot';dot.dataset.slide=i;dot.setAttribute('aria-label','Show image '+(i+1));controls.append(dot);});list.forEach((s,i)=>{const img=document.createElement('img');img.src=s.src;img.alt=s.alt;img.decoding='async';if(i>0)img.loading='lazy';img.addEventListener('error',()=>{img.src='assets/hero.jpg';},{once:true});layer.append(img);});controls.hidden=list.length<2;show(0);};
 }
 const home=slider(document.querySelector('.hero-image'),'Featured meat photography');home(SITE_DATA.homeSlides);
 const category=slider(document.querySelector('.category-feature'),'Category serving inspiration');let previous;
 function update(name){if(previous===name)return;previous=name;category(SITE_DATA.categories.find(c=>c.name===name).slides);}
 update(active);window.addEventListener('categorychange',e=>update(e.detail));
})();
