(async()=>{
 const response=await fetch('/api/site',{cache:'no-store'}).catch(()=>null);
 let data;
 if(response?.ok&&response.headers.get('content-type')?.includes('application/json'))data=await response.json();
 else{try{data=JSON.parse(localStorage.getItem('joes-demo-site-v1'));}catch(e){} if(!data)data=await (await fetch('site-defaults.json')).json();}
 window.SITE_DATA=data;
 const set=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
 function heading(selector,value){const el=document.querySelector(selector);el.replaceChildren();const lines=value.split('\n');lines.forEach((line,i)=>{const child=document.createElement(i===lines.length-1?'em':'span');child.textContent=line;el.append(child);if(i<lines.length-1)el.append(document.createElement('br'));});}
 const c=data.copy;
 set('.announcement>span',c.announcement);set('.hero .eyebrow',c.homeEyebrow);heading('#hero-title',c.homeTitle);set('.hero-description',c.homeDescription);heading('.story-copy h2',c.storyTitle);
 document.querySelectorAll('.story-copy>p:not(.eyebrow)').forEach(el=>el.remove());
 const storyHeading=document.querySelector('.story-copy h2');let anchor=storyHeading;
 c.storyText.split('\n\n').forEach(text=>{const p=document.createElement('p');p.textContent=text;anchor.after(p);anchor=p;});
 document.querySelector('.story-photo img').src=c.storyImage;document.querySelector('.brand img').src=c.logo;
 const hours=document.querySelectorAll('.hours strong');hours[0].textContent=c.weekdays;hours[1].textContent=c.sunday;
 for(const name of ['facebook','instagram'])document.querySelector('.social-icon.'+name).href=c[name];
 document.querySelector('footer a[href*="privacy"]').href=c.privacy;
 document.querySelectorAll('.location-card').forEach((card,i)=>{
  const s=data.stores[i];card.querySelector('h3').textContent=s.name;card.querySelector('p').textContent=s.address;card.querySelector('p').style.whiteSpace='pre-line';
  const phone=card.querySelector('a[href^="tel:"]');phone.href='tel:+'+s.phone;phone.textContent='+'+s.phone;
  const email=card.querySelector('a[href^="mailto:"]');email.href='mailto:'+s.email;email.textContent=s.email;
  card.querySelector('.location-actions .primary').href='https://wa.me/'+s.whatsapp;card.querySelector('.location-actions .text-link').href=s.directions;
  card.style.setProperty('--store-photo','url('+JSON.stringify(s.image)+')');
 });
 const select=document.querySelector('#store');select.replaceChildren();data.stores.forEach(s=>{const option=document.createElement('option');option.value=s.whatsapp;option.textContent=s.name;select.append(option);});
 for(const file of ['app.js','polish.js','sliders.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=file;script.onload=resolve;script.onerror=reject;document.body.append(script);});
})().catch(()=>{const message=document.createElement('p');message.className='load-error';message.textContent='The catalog could not be loaded. Please refresh the page.';document.querySelector('#products').append(message);});
