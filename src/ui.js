const $ = (id) => document.getElementById(id);
const address = $('address'), url = $('url'), panel = $('panel'), menu = $('vr-menu'), media = $('media');
let toastTimer;
function toast(text){ const node=$('toast'); node.textContent=text; node.style.opacity='1'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>node.style.opacity='0',2400); }
function render(items){ $('count').textContent=items.length; media.replaceChildren(); $('hint').hidden=items.length>0; for(const item of items){const card=document.createElement('div');card.className='media-card';const name=document.createElement('div');name.className='media-url';name.textContent=item;const actions=document.createElement('div');actions.className='actions';const copy=document.createElement('button');copy.textContent='Copiar link';copy.onclick=()=>{window.vrlink.copy(item);toast('Link copiado. Cole no player do mundo VRChat.');};const open=document.createElement('button');open.className='primary';open.textContent='Abrir VRChat';open.onclick=()=>{window.vrlink.openVRChat(item);toast('Solicitação enviada ao VRChat.');};actions.append(copy,open);card.append(name,actions);media.append(card);}}
address.addEventListener('submit',(event)=>{event.preventDefault();window.vrlink.navigate(url.value);});
$('home').onclick=()=>window.vrlink.home();$('back').onclick=()=>window.vrlink.back();$('forward').onclick=()=>window.vrlink.forward();$('reload').onclick=()=>window.vrlink.reload();
function setPanel(show){panel.hidden=!show;menu.setAttribute('aria-expanded',String(show));window.vrlink.panel(show);}menu.onclick=()=>setPanel(panel.hidden);$('close').onclick=()=>setPanel(false);
$('scan').onclick=async()=>{await window.vrlink.scan();toast('Verificação acionada. Reproduza o vídeo se ainda não aparecer.');};
window.vrlink.onState((state)=>{url.value=state.url||url.value;document.title=state.title?`${state.title} — VRLink`:'VRLink Browser';$('blocked').textContent=state.blocked; $('back').disabled=!state.canGoBack;$('forward').disabled=!state.canGoForward;render(state.media||[]);});
window.vrlink.onError(({description})=>toast(`Não foi possível abrir: ${description}`));
