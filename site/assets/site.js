(function(){
  const toggle=document.querySelector('.mobile-toggle'); const sb=document.querySelector('.sidebar');
  if(toggle&&sb) toggle.addEventListener('click',()=>sb.classList.toggle('open'));
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  document.querySelectorAll('.nav a').forEach(a=>{if((a.getAttribute('href')||'').toLowerCase()===file)a.classList.add('active')});
  const search=document.querySelector('.nav-search');
  if(search) search.addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();document.querySelectorAll('.nav a').forEach(a=>{a.style.display=!q||a.textContent.toLowerCase().includes(q)?'flex':'none'})});
  document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const el=document.getElementById(btn.dataset.copy);if(!el)return;try{await navigator.clipboard.writeText(el.innerText);const t=btn.textContent;btn.textContent='COPIED';setTimeout(()=>btn.textContent=t,1200)}catch(e){btn.textContent='SELECT + COPY'}}));
})();
