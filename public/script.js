const $=i=>document.getElementById(i),me=Math.random().toString(36).slice(2),RM=()=>location.hash.slice(1);
const say=t=>{$('note').textContent=t;$('ph').textContent=t||'Nothing playing';if(t)$('ph').classList.remove('hide')};
let authUser=null;
function closeAccountDrawer(){
  $('accountDrawer').classList.remove('open');$('accountDrawer').setAttribute('aria-hidden','true');
  $('accountDrawer').setAttribute('inert','');
  $('accountToggle').setAttribute('aria-expanded','false');$('accountDrawerBackdrop').classList.add('hide');
  document.body.style.overflow='';
}
function openAccountDrawer(){
  $('accountDrawer').removeAttribute('inert');
  renderAccountMenu();$('accountDrawerBackdrop').classList.remove('hide');
  requestAnimationFrame(()=>{$('accountDrawer').classList.add('open');$('accountDrawerBackdrop').classList.add('open')});
  $('accountDrawer').setAttribute('aria-hidden','false');$('accountToggle').setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';$('accountClose').focus();
}
function renderAccountMenu(){
  const menu=$('accountMenu');menu.replaceChildren();
  const addOption=(label,action)=>{
    const button=document.createElement('button');button.type='button';button.dataset.accountAction=action;
    button.textContent=label;menu.append(button);
  };
  if(authUser){
    addOption('Profile','profile');
    addOption('Log out','logout');
  }else{
    addOption('Sign up / Log in','login');
  }
  $('accountUser').textContent=authUser?authUser.username+' · signed in':'Sign in to access your profile on any device.';
}
function setAuthUser(user){
  authUser=user;
  $('accountToggle').setAttribute('aria-label',user?'Open account menu for '+user.username:'Open account menu');
  $('accountToggle').classList.toggle('hide',!user);
  $('accountToggle').querySelector('.profile-avatar').classList.toggle('hide',!user);
  renderAccountMenu();
}
function setTheme(theme){
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('themeToggle').querySelector('.theme-toggle-icon').textContent=dark?'☀':'☾';
  $('themeToggle').querySelector('.theme-toggle-label').textContent=dark?'Light':'Dark';
  $('themeToggle').setAttribute('aria-pressed',String(dark));
  $('themeToggle').setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');
  document.querySelector('meta[name="theme-color"]').content=dark?'#18221c':'#FAF9F5';
  try{localStorage.setItem('play-together-theme',dark?'dark':'light')}
  catch(error){console.error('Theme preference could not be saved:',error)}
}
function showMainView(){
  closeAccountDrawer();$('auth').classList.add('hide');$('profile').classList.add('hide');
  const inRoom=Boolean(authUser&&RM());
  $('app').classList.toggle('hide',!inRoom);
  ['hero','join','features'].forEach(id=>$(id).classList.toggle('hide',inRoom));
  document.querySelectorAll('.landing-only').forEach(element=>element.classList.toggle('hide',inRoom));
  document.querySelector('.header-nav').classList.toggle('hide',inRoom);
  $('signInLink').classList.toggle('hide',inRoom||Boolean(authUser));
}
function showAuth(signup,message=''){
  closeAccountDrawer();$('hero').classList.add('hide');$('join').classList.add('hide');$('features').classList.add('hide');$('app').classList.add('hide');$('profile').classList.add('hide');
  document.querySelectorAll('.landing-only').forEach(element=>element.classList.add('hide'));
  document.querySelector('.header-nav').classList.add('hide');$('signInLink').classList.add('hide');
  $('auth').classList.remove('hide');
  $('loginForm').classList.toggle('hide',signup);$('signupForm').classList.toggle('hide',!signup);
  $('authTitle').textContent=signup?'Make room for good things':'Welcome back';
  $('authDescription').textContent=signup?'Create an account to make yourself at home.':'Sign in to your account.';
  $('authSwitch').innerHTML=signup?'Already have an account? ':'New here? ';
  const switchButton=document.createElement('button');switchButton.type='button';
  switchButton.textContent=signup?'Sign in':'Create an account';
  switchButton.onclick=()=>showAuth(!signup);$('authSwitch').append(switchButton);
  $('authNote').textContent=message;
  (signup?$('signupForm'): $('loginForm')).querySelector('input').focus();
}
function showProfile(){
  if(!authUser){showAuth(false,'Sign in to view your profile.');return}
  closeAccountDrawer();$('hero').classList.add('hide');$('join').classList.add('hide');$('features').classList.add('hide');$('app').classList.add('hide');$('auth').classList.add('hide');
  document.querySelectorAll('.landing-only').forEach(element=>element.classList.add('hide'));
  document.querySelector('.header-nav').classList.add('hide');$('signInLink').classList.add('hide');
  $('profileWelcome').textContent='Welcome, '+authUser.displayName+'.';
  $('profileUsername').textContent='@'+authUser.username;$('profileEmail').textContent=authUser.email;
  $('profile').classList.remove('hide');
}
async function sendAuthRequest(action,data){
  const response=await fetch('/api/auth',{
    method:action==='profile'?'GET':'POST',
    headers:action==='profile'?{}:{'Content-Type':'application/json'},
    ...(action==='profile'?{}:{body:JSON.stringify({action,...data})}),
    cache:'no-store',
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'Authentication request failed.');
  return result;
}
async function handleAuthSubmit(event,action){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');
  button.disabled=true;$('authNote').textContent=action==='signup'?'Creating your account…':'Signing you in…';
  try{
    const result=await sendAuthRequest(action,Object.fromEntries(new FormData(form)));
    setAuthUser(result.user);form.reset();showProfile();
  }catch(error){
    console.error('Authentication request failed:',error);
    $('authNote').textContent=error.message||'Could not complete the request. Please try again.';
  }finally{button.disabled=false}
}
async function loadCurrentUser(){
  if(!/^https?:$/.test(location.protocol)){
    setAuthUser(null);
    if(RM())history.replaceState(null,'',location.pathname+location.search);
    showMainView();
    return;
  }
  try{
    const result=await sendAuthRequest('profile',{});
    setAuthUser(result.user||null);
    if(result.user&&RM())enter(RM());
    else{
      const requestedRoom=RM();
      if(!result.user&&requestedRoom)history.replaceState(null,'',location.pathname+location.search);
      showMainView();
      if(!result.user&&requestedRoom)flashToast('Sign in or create an account to enter a room.',true);
    }
  }catch(error){
    console.error('Account status could not be loaded:',error);
    setAuthUser(null);
    if(RM())history.replaceState(null,'',location.pathname+location.search);
    showMainView();
    $('accountUser').textContent='Could not verify account status. Room access is unavailable.';
    flashToast('Could not verify your account. Please try again.',true);
  }
}
try{setTheme(localStorage.getItem('play-together-theme')==='dark'?'dark':'light')}
catch(error){console.error('Theme preference could not be loaded:',error);setTheme('light')}
if($('themeToggle'))$('themeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
if($('signInLink'))$('signInLink').onclick=event=>{event.preventDefault();showAuth(false)};
$('showSignup').onclick=()=>showAuth(true);
$('accountToggle').onclick=openAccountDrawer;
$('accountClose').onclick=closeAccountDrawer;
$('accountDrawerBackdrop').onclick=closeAccountDrawer;
$('accountMenu').onclick=async event=>{
  const action=event.target.closest('[data-account-action]')?.dataset.accountAction;
  if(!action)return;
  closeAccountDrawer();
  if(action==='profile')showProfile();
  else if(action==='login')showAuth(false);
  else if(action==='logout'){
    try{await sendAuthRequest('logout',{});setAuthUser(null);showAuth(false,'You are signed out.')}
    catch(error){console.error('Sign out failed:',error);flashToast(error.message||'Could not sign out.',true)}
  }
};
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAccountDrawer()});
$('loginForm').onsubmit=event=>handleAuthSubmit(event,'login');
$('signupForm').onsubmit=event=>handleAuthSubmit(event,'signup');
$('profileBack').onclick=showMainView;
$('authBack').onclick=event=>{event.preventDefault();showMainView()};
loadCurrentUser();
document.querySelectorAll('.header-nav a').forEach(link=>link.onclick=event=>{
  event.preventDefault();$(link.getAttribute('href').slice(1)).scrollIntoView({behavior:'smooth',block:'start'});
});
$('brandHome').onclick=event=>{
  if(!RM())return;
  event.preventDefault();location.href=location.pathname+location.search;
};
function focusRoom(action){
  if(!authUser){
    showAuth(false,'Sign in or create an account to create or join a room.');
    return;
  }
  $('roomFeedback').textContent=action==='create'?'Choose a name, then create your shared room.':'Enter your friend’s room name or paste their invite link.';
  $('roomFeedback').classList.remove('error');
  $('join').scrollIntoView({behavior:'smooth',block:'center'});
  $('room').focus({preventScroll:true});
}
function submitRoom(action){
  if(!authUser){
    showAuth(false,'Sign in or create an account to create or join a room.');
    return;
  }
  let room=$('room').value.trim();
  if(/^https?:\/\//i.test(room)){
    try{room=new URL(room).hash.slice(1)}
    catch(error){$('roomFeedback').textContent='That invite link could not be read.';$('roomFeedback').classList.add('error');return}
  }
  room=room.replace(/^#/,'').trim().replace(/\s+/g,'-').toLowerCase();
  if(!/^[a-z0-9_-]{1,24}$/.test(room)){
    $('roomFeedback').textContent=room?'Use 1–24 letters, numbers, hyphens, or underscores for a room name.':'Enter a room name or invite link first.';
    $('roomFeedback').classList.add('error');$('room').focus();return;
  }
  $('roomFeedback').classList.remove('error');
  enter(room);
}
$('createRoom').onclick=()=>focusRoom('create');
$('joinRoom').onclick=()=>focusRoom('join');
$('createRoomSubmit').onclick=()=>submitRoom('create');
$('joinRoomSubmit').onclick=()=>submitRoom('join');
$('room').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submitRoom('join')}};
let toastTimer;
function flashToast(message,error=false){
  const toast=$('toast');
  toast.textContent=message;toast.classList.toggle('error',error);
  toast.classList.remove('show');void toast.offsetWidth;toast.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2000);
}
const fmt=s=>isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
let mode='au',type=null,vid=null,meta=null,playing=false,loopEnabled=false,shuffleEnabled=false,trackQueue=[],currentTrackIndex=-1,mute=0,lastV=0,okNet=true,chatEditId=null,chatReply=null;
let player=null,ytReady=false,pending=null,expect=0,expectTs=0;
const chatNodes=new Map();
const au=$('au'),lock=ms=>{mute=Date.now()+(ms||1800)},muted=()=>Date.now()<mute;
const post=(pl,pos)=>fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:RM(),id:me,type,vid,meta,playing:pl,pos,loop:loopEnabled,shuffle:shuffleEnabled})}).catch(()=>{});
function renderChat(messages,snapshot=false){
  const box=$('chatMessages');
  const wasAtBottom=box.scrollHeight-box.scrollTop-box.clientHeight<48;
  let added=false;
  if(snapshot){
    const ids=new Set(messages.map(message=>message&&message.id).filter(Boolean));
    for(const [id,node] of chatNodes){
      if(!ids.has(id)){node.remove();chatNodes.delete(id)}
    }
  }
  messages.forEach(message=>{
    if(!message||!message.id)return;
    let item=chatNodes.get(message.id);
    const isNew=!item;
    if(!item){
      item=document.createElement('div');
      item.className='chat-message'+(message.from===me?' mine':'')+(message.kind==='reaction'?' reaction':'');
      if(message.kind==='reaction'){
        item.textContent=message.text;item.setAttribute('aria-label','Room reaction '+message.text);
      }else{
        const author=document.createElement('span'),content=document.createElement('div'),text=document.createElement('p');
        author.className='chat-author';author.textContent=message.from===me?'You':'Friend';
        content.className='chat-message-content';text.className='chat-text';content.append(text);
        if(message.replyTo){
          const quote=document.createElement('button'),quotedAuthor=document.createElement('b'),quotedText=document.createElement('span');
          quote.type='button';quote.className='chat-quote';
          quotedAuthor.textContent=message.replyTo.from===me?'You':'Friend';
          quotedText.textContent=message.replyTo.text;
          quote.append(quotedAuthor,quotedText);
          quote.onclick=()=>{
            const original=chatNodes.get(item.message.replyTo.id);
            if(original){original.scrollIntoView({behavior:'smooth',block:'center'});original.classList.add('highlight');setTimeout(()=>original.classList.remove('highlight'),1400)}
          };
          content.prepend(quote);
        }
        item.append(author,content);
      }
      chatNodes.set(message.id,item);added=true;
    }
    if(message.kind!=='reaction'){
      const wasEdited=item.message&&item.message.edited;
      const text=item.querySelector('.chat-text');
      const displayText=message.text+(message.edited?' (edited)':'');
      if(text.textContent!==displayText)text.textContent=displayText;
      const content=item.querySelector('.chat-message-content');
      if(!content.querySelector('.chat-actions')){
        const actions=document.createElement('div'),reply=document.createElement('button');
        actions.className='chat-actions';reply.type='button';reply.textContent='Reply';
        reply.setAttribute('aria-label','Reply to message');reply.onclick=()=>replyToChatMessage(item.message);
        actions.append(reply);
        if(message.from===me){
          const edit=document.createElement('button'),remove=document.createElement('button');
          edit.type=remove.type='button';edit.textContent='Edit';remove.textContent='Delete';
          edit.setAttribute('aria-label','Edit your message');remove.setAttribute('aria-label','Delete your message');
          edit.onclick=()=>startChatEdit(item.message);remove.onclick=()=>deleteChatMessage(item.message.id);
          actions.append(edit,remove);
        }
        content.append(actions);
      }
      item.message=message;
      if(message.edited&&!wasEdited&&item.parentElement===box)box.append(item);
    }
    if(isNew)box.append(item);
  });
  $('chatEmpty').classList.toggle('hide',chatNodes.size>0);
  while(chatNodes.size>50){
    const [id,node]=chatNodes.entries().next().value;
    chatNodes.delete(id);node.remove();
  }
  if(added&&wasAtBottom)box.scrollTop=box.scrollHeight;
}
async function sendChat(text,kind,replyToId){
  const message=String(text||'').trim();if(!message||!RM())return false;
  try{
    const body={room:RM(),id:me,kind,text:message};
    if(kind==='chat'&&replyToId)body.replyToId=replyToId;
    const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    if(d.message)renderChat([d.message]);
    return true;
  }catch(e){say('Chat could not send: '+e.message);return false}
}
function updateChatContext(){
  const context=$('chatContext'),input=$('chatInput'),editing=!!chatEditId;
  context.classList.toggle('hide',!editing&&!chatReply);
  if(editing){
    $('chatContextTitle').textContent='Editing your message';
    $('chatContextText').textContent=chatEditText;
  }else if(chatReply){
    $('chatContextTitle').textContent='Replying to '+(chatReply.from===me?'your message':'Friend');
    $('chatContextText').textContent=chatReply.text;
  }
  input.placeholder=editing?'Edit your message…':chatReply?'Write a reply…':'Send a message…';
  $('chatSend').textContent=editing?'✓':'↑';
  $('chatSend').setAttribute('aria-label',editing?'Save edited message':'Send message');
}
let chatEditText='';
function clearChatContext(){
  chatEditId=null;chatEditText='';chatReply=null;updateChatContext();
}
function replyToChatMessage(message){
  if(chatEditId)$('chatInput').value='';
  chatEditId=null;chatEditText='';chatReply={id:message.id,from:message.from,text:message.text};
  updateChatContext();$('chatInput').focus();
}
function startChatEdit(message){
  chatReply=null;chatEditId=message.id;chatEditText=message.text;
  $('chatInput').value=message.text;updateChatContext();
  $('chatInput').focus();$('chatInput').setSelectionRange(message.text.length,message.text.length);
}
async function editChatMessage(messageId,text){
  try{
    const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:RM(),id:me,kind:'edit',messageId,text})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    if(d.message)renderChat([d.message]);
    return true;
  }catch(e){say('Message could not be edited: '+e.message);return false}
}
async function deleteChatMessage(messageId){
  try{
    const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:RM(),id:me,kind:'delete',messageId})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    const node=chatNodes.get(d.deletedId);if(node)node.remove();chatNodes.delete(d.deletedId);
    $('chatEmpty').classList.toggle('hide',chatNodes.size>0);
    if(chatEditId===messageId){$('chatInput').value='';clearChatContext()}
    else if(chatReply&&chatReply.id===messageId)clearChatContext();
  }catch(e){say('Message could not be deleted: '+e.message)}
}
if($('chatForm'))$('chatForm').onsubmit=async e=>{
  e.preventDefault();
  const input=$('chatInput'),text=input.value.trim();
  if(!text)return;
  $('chatSend').disabled=true;
  const saved=chatEditId?await editChatMessage(chatEditId,text):await sendChat(text,'chat',chatReply&&chatReply.id);
  $('chatSend').disabled=false;
  if(saved){input.value='';clearChatContext()}
};
$('chatContextCancel').onclick=()=>{
  if(chatEditId)$('chatInput').value='';
  clearChatContext();
};
document.querySelectorAll('[data-reaction]').forEach(button=>button.onclick=()=>sendChat(button.dataset.reaction,'reaction'));

function setMode(m){
  mode=m;
  $('tabAu').classList.toggle('on',m==='au');$('tabYt').classList.toggle('on',m==='yt');
  $('audioView').classList.toggle('hide',m!=='au');$('videoView').classList.toggle('hide',m!=='yt');
  lock();
  if(m==='au'){if(player&&player.pauseVideo){try{player.pauseVideo()}catch(e){}}}else au.pause();
}
$('tabAu').onclick=()=>setMode('au');$('tabYt').onclick=()=>setMode('yt');

/* ---------- Audio ---------- */
function showNow(){
  $('np').classList.remove('hide');$('ttl').textContent=(meta&&meta.title)||'';$('art').textContent=(meta&&meta.artist)||'';
  const i=$('cover');i.src=meta&&/^https:\/\//.test(meta.art||'')?meta.art:'assets/Sunset%20Vibes%20Lofi%20Mix.png';i.classList.remove('hide');
}
async function playAudio(id,m,pos,play){
  type='au';vid=id;meta=m||{};au.loop=loopEnabled;showNow();updatePlaybackControls();say('Loading…');lock(6000);
  try{
    const r=await fetch('/api/stream?id='+encodeURIComponent(id)),d=await r.json();if(!d.url)throw new Error();
    au.src=d.url;au.onloadedmetadata=()=>{if(pos>0)au.currentTime=pos};
    say('');if(play)await au.play();
  }catch(e){say(e&&e.name==='NotAllowedError'?'Tap Play to start.':"Couldn't load this track. Try another one.")}
}
function updatePlaybackControls(){
  const paused=type==='au'?au.paused:!playing;
  const playButton=$('apb');
  playButton.querySelector('img').src=paused?'assets/play.png':'assets/pause.png';
  playButton.querySelector('.player-label').textContent=paused?'Play':'Pause';
  playButton.setAttribute('aria-label',paused?'Play':'Pause');
  $('loop').setAttribute('aria-pressed',String(loopEnabled));
  $('loop').setAttribute('aria-label','Loop '+(loopEnabled?'on':'off'));
  $('shuffle').setAttribute('aria-pressed',String(shuffleEnabled));
  $('shuffle').setAttribute('aria-label','Shuffle '+(shuffleEnabled?'on':'off'));
}
function currentPosition(){
  if(type==='au')return au.currentTime;
  if(type==='yt'&&player&&player.getCurrentTime)return player.getCurrentTime();
  return 0;
}
function playQueueTrack(index){
  if(!trackQueue.length){say('Search for a few songs to use the shared queue.');return}
  currentTrackIndex=(index+trackQueue.length)%trackQueue.length;
  const track=trackQueue[currentTrackIndex];
  $('res').innerHTML='';
  playAudio(track.id,{title:track.title,artist:track.artist,art:track.art},0,true);
  playing=true;post(true,0);
}
function moveQueue(direction){
  if(type==='au'&&direction<0&&au.currentTime>3){au.currentTime=0;post(true,0);return}
  if(!trackQueue.length){say('Search for a few songs to use the shared queue.');return}
  if(currentTrackIndex<0){playQueueTrack(0);return}
  if(direction>0&&shuffleEnabled&&trackQueue.length>1){
    let next=currentTrackIndex;
    while(next===currentTrackIndex)next=Math.floor(Math.random()*trackQueue.length);
    playQueueTrack(next);return;
  }
  playQueueTrack(currentTrackIndex+direction);
}
function togglePlaybackOption(option){
  if(option==='loop'){loopEnabled=!loopEnabled;au.loop=loopEnabled}
  else shuffleEnabled=!shuffleEnabled;
  updatePlaybackControls();
  if(type)post(playing,currentPosition());
}
au.addEventListener('play',updatePlaybackControls);au.addEventListener('pause',updatePlaybackControls);
au.onplay=()=>{if(muted())return;playing=true;post(true,au.currentTime)};
au.onpause=()=>{if(muted()||au.ended)return;playing=false;post(false,au.currentTime)};
au.onseeked=()=>{if(muted())return;post(!au.paused,au.currentTime)};
au.onended=()=>{if(loopEnabled){au.currentTime=0;au.play().catch(error=>say('Playback could not restart: '+error.message));return}playing=false;updatePlaybackControls();if(!muted())post(false,0)};
au.ontimeupdate=()=>{if(isFinite(au.duration))$('bar').max=Math.floor(au.duration);$('bar').value=au.currentTime;$('t').textContent=fmt(au.currentTime)+' / '+fmt(au.duration)};
$('bar').oninput=()=>{if(type==='au')au.currentTime=+$('bar').value};
$('apb').onclick=()=>{
  if(type==='au'){
    if(au.paused)au.play().catch(error=>say('Playback could not start: '+error.message));
    else au.pause();
  }else if(type==='yt'&&player){
    if(playing)player.pauseVideo();else player.playVideo();
  }
};
$('previous').onclick=()=>moveQueue(-1);
$('next').onclick=()=>moveQueue(1);
$('loop').onclick=()=>togglePlaybackOption('loop');
$('shuffle').onclick=()=>togglePlaybackOption('shuffle');
async function search(){
  const q=$('q').value.trim();if(!q)return;say('Searching…');
  try{
    const r=await fetch('/api/search?q='+encodeURIComponent(q)),d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    const ul=$('res');ul.innerHTML='';
    if(!d.tracks.length){say('No results.');return}
    say('');trackQueue=d.tracks;currentTrackIndex=-1;
    d.tracks.forEach((t,index)=>{
      const li=document.createElement('li'),a=document.createElement('b'),b=document.createElement('span');
      a.textContent=t.title;b.textContent=(t.artist||'')+(t.from?' · '+t.from:'');li.append(a,b);
      li.onclick=()=>{currentTrackIndex=index;ul.innerHTML='';playing=true;playAudio(t.id,{title:t.title,artist:t.artist,art:t.art},0,true);post(true,0)};
      ul.append(li);
    });
  }catch(e){say('Search failed: '+e.message)}
}
$('sb').onclick=search;$('q').onkeydown=e=>{if(e.key==='Enter')search()};

/* ---------- Video (YouTube) ---------- */
window.onYouTubeIframeAPIReady=()=>{ytReady=true;if(pending){const p=pending;pending=null;apply(p)}};
const ytId=s=>{const m=s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);return m?m[1]:/^[\w-]{11}$/.test(s.trim())?s.trim():null};
function makePlayer(id,pos,play){
  if(typeof YT==='undefined'||!YT.Player){pending={type:'yt',vid:id,pos:pos,playing:play};ytReady=false;say('Loading YouTube player… if this stays, disable your ad blocker.');return}
  $('ph').classList.add('hide');say('');
  if(player){try{player.destroy()}catch(e){}player=null}
  $('ytw').innerHTML='<div id="yt"></div>';
  player=new YT.Player('yt',{videoId:id,playerVars:{start:Math.floor(pos),autoplay:play?1:0,playsinline:1,rel:0},
    events:{onStateChange:e=>{
      if(muted())return;
      if(e.data===1||e.data===2){playing=e.data===1;updatePlaybackControls();post(playing,player.getCurrentTime())}
      else if(e.data===0&&loopEnabled){player.seekTo(0,true);player.playVideo();playing=true;post(true,0)}
      else if(e.data===0){playing=false;updatePlaybackControls();post(false,0)}
    }}});
}
$('load').onclick=()=>{
  const id=ytId($('url').value);if(!id){say("That doesn't look like a YouTube link.");return}
  type='yt';meta=null;vid=id;playing=true;lock();say('Loading…');makePlayer(id,0,true);setTimeout(()=>post(true,0),800);
};
setInterval(()=>{ // detect manual seeks in the YouTube player
  if(type!=='yt'||!player||!player.getCurrentTime||muted())return;
  const t=player.getCurrentTime(),exp=expect+(playing?(Date.now()-expectTs)/1000:0);
  if(Math.abs(t-exp)>2.5)post(playing,t);
  expect=t;expectTs=Date.now();
},1000);

/* ---------- Sync ---------- */
function apply(s){
  loopEnabled=!!s.loop;shuffleEnabled=!!s.shuffle;au.loop=loopEnabled;
  const m=s.type==='au'?'au':'yt';
  if(m!==mode)setMode(m);
  playing=s.playing;
  updatePlaybackControls();
  if(m==='au'){
    lock(s.vid!==vid||type!=='au'?6000:1800);
    if(s.vid!==vid||type!=='au'){playAudio(s.vid,s.meta,s.pos,s.playing);return}
    if(Math.abs(au.currentTime-s.pos)>1)au.currentTime=s.pos;
    s.playing?au.play().catch(()=>say('Tap Play to start.')):au.pause();
    return;
  }
  if(!ytReady){pending=s;return}
  lock();type='yt';meta=null;expect=s.pos;expectTs=Date.now();
  if(s.vid!==vid||!player||!player.seekTo){vid=s.vid;makePlayer(s.vid,s.pos,s.playing);return}
  player.seekTo(s.pos,true);s.playing?player.playVideo():player.pauseVideo();
}
async function poll(n){
  try{
    const r=await fetch('/api/room?room='+n+'&id='+me,{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    if(!okNet){okNet=true;if($('note').textContent.startsWith('Sync'))say('')}
    const members=Math.max(1,Math.floor(Number(d.peers)||1));
    $('dot').className='dot'+(members>1?' on':'');
    $('status').textContent=members>1?members+' members here':'Just you for now';
    $('chatMembers').textContent=members+' '+(members===1?'member':'members');
    renderChat(d.chat||[],true);
    const s=d.state;if(s&&s.v!==lastV){lastV=s.v;if(s.from!==me)apply(s)}
  }catch(e){okNet=false;$('status').textContent='Not connected';say('Sync problem: '+e.message)}
  setTimeout(()=>poll(n),1000);
}
function enter(n){
  if(!authUser){
    showAuth(false,'Sign in or create an account to create or join a room.');
    return;
  }
  n=n.replace(/[^\w-]/g,'').toLowerCase();if(!n)return;
  closeAccountDrawer();location.hash=n;$('auth').classList.add('hide');$('profile').classList.add('hide');$('hero').classList.add('hide');$('join').classList.add('hide');$('features').classList.add('hide');document.querySelectorAll('.landing-only').forEach(element=>element.classList.add('hide'));document.querySelector('.header-nav').classList.add('hide');$('app').classList.remove('hide');poll(n);
}
$('copy').onclick=async()=>{
  try{
    await navigator.clipboard.writeText(location.href);
    flashToast('Invite link copied!');
  }catch(error){
    console.error('Invite link could not be copied:',error);
    flashToast('Could not copy the invite link.',true);
  }
};
window.addEventListener('pagehide',()=>{
  const room=RM();
  if(!room)return;
  const body=JSON.stringify({room,id:me,kind:'leave'});
  if(!navigator.sendBeacon||!navigator.sendBeacon('/api/room',new Blob([body],{type:'application/json'}))){
    fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true})
      .catch(error=>console.error('Room cleanup request failed:',error));
  }
});
setTimeout(()=>{if(typeof YT==='undefined'&&mode==='yt')say("Couldn't load the YouTube player. Check your connection or ad blocker.")},5000);
