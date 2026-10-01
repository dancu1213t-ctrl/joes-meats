/* Calculate in integer cents, so decimal prices never accumulate rounding errors. */
(function(root){
 const maxQuantity=1000000;
 const validQuantity=q=>Number.isInteger(q)&&q>=1&&q<=maxQuantity;
 const lineCents=item=>Math.round(item.price*100)*item.quantity;
 const totalCents=items=>items.reduce((sum,item)=>sum+lineCents(item),0);
 const format=cents=>'$'+(cents/100).toFixed(2);
 function message(items,store,notes='',pickupOverride=''){
  const separator='________________________';
  const pickup=pickupOverride||(store==='San Pedro'
   ? 'https://maps.app.goo.gl/ThXd656n4YHrLeed8'
   : 'https://maps.app.goo.gl/7SUYhuSdUMYCMHmv6');
  return ['*_Joe’s Meats Order Request_*','',
   'Store: '+store,'Can You Confirm Availability?',separator,
   ...items.flatMap((p,i)=>[`${i+1}. ${p.name}\n   ${p.quantity} × ${format(Math.round(p.price*100))} = ${format(lineCents(p))} BZD`,separator]),
   `Total quantity: ${items.reduce((n,p)=>n+p.quantity,0)}`,separator,
   `Estimated total: ${format(totalCents(items))}`,separator,
   ...(notes?['Notes: '+notes,separator]:[]),
   'Pickup Location: '+pickup
  ].join('\n');
 }
 const api={maxQuantity,validQuantity,lineCents,totalCents,message};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.CartMath=api;
})(globalThis);
