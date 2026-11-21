const phoneLayout='(max-width:760px), (max-width:960px) and (max-height:540px) and (pointer:coarse)';

export function initMobileHud({setView,closeDetail,win=window,doc=document}={}) {
  const get=id=>doc.getElementById(id);
  const app=get('app'),bar=get('mobile-hud-bar'),handle=get('mobile-hud-toggle'),slot=get('mobile-hud-views');
  if(!app || !bar || !handle || !slot)return;
  const tray=app.querySelector('.sidebar'),mapRegion=app.querySelector('.map-region'),nav=app.querySelector('.view-switch');
  const search=get('search-input'),query=win.matchMedia(phoneLayout),viewport=win.visualViewport;
  const home=doc.createComment('Map and list switch');nav.before(home);
  const remove=[];
  function listen(target,event,fn,opts){
    if(!target)return;
    target.addEventListener(event,fn,opts);remove.push(()=>target.removeEventListener(event,fn,opts));
  }
  let active=false,expanded=false,watcher=null,historyFrame=null,swipe=null,skipClick=false;
  let previousView=app.dataset.view,hadDetails=false,closed=false;
  const inList=()=>app.dataset.view==='list';
  const inDetail=()=>app.classList.contains('detail-open');
  const hasModal=()=>Boolean(doc.querySelector('dialog[open]'));
  const needsBack=()=>active && (inDetail() || expanded || inList());
  const token='pinch-hud-'+Math.random().toString(36).slice(2);

  function measure(){
    if(!active)return;
    const h=Math.ceil(tray.getBoundingClientRect().height);
    const visible=viewport?.height || win.innerHeight;
    const layout=doc.documentElement.clientHeight || win.innerHeight;
    const focused=doc.activeElement?.matches('input, textarea, [contenteditable=true]');
    const covered=focused && viewport ? Math.max(0,Math.round(layout-visible-viewport.offsetTop)):0;
    app.style.setProperty('--hud-tray-height',h+'px');
    app.style.setProperty('--hud-visible-height',Math.round(visible)+'px');
    app.style.setProperty('--hud-keyboard-inset',(covered>90?covered:0)+'px');
  }
  function setExpanded(next,{focus=false}={}){
    if(!active)return;
    if(next && historyFrame)historyFrame.navigation=false;
    expanded=next;tray.scrollTop=0;
    if(!next && tray.contains(doc.activeElement) && !slot.contains(doc.activeElement)){
      if(focus || doc.activeElement===search)handle.focus({preventScroll:true});
    }
    sync();
  }
  function dismiss(){
    if(!active || hasModal())return false;
    if(inDetail()){closeDetail?.();return true;}
    if(inList()){setView?.('map');setExpanded(false,{focus:true});handle.focus({preventScroll:true});return true;}
    if(expanded){setExpanded(false,{focus:true});handle.focus({preventScroll:true});return true;}
    return false;
  }
  function forgetWatcher(){
    if(watcher){watcher.destroy();watcher=null;}
  }
  function releaseHistory(){
    if(!historyFrame || historyFrame.retiring)return;
    if(win.history.state?.pinchHud!==token || win.location.href!==historyFrame.href){historyFrame=null;return;}
    // A geographic fit is about to use the current history entry. Never
    // traverse it asynchronously while the application writes the destination.
    if(historyFrame.navigation)return;
    historyFrame.retiring=true;
    try{win.history.back();}catch{historyFrame=null;}
  }
  function syncBack(){
    if(closed)return;
    if(!needsBack()){forgetWatcher();releaseHistory();return;}
    if(typeof win.CloseWatcher==='function'){
      if(!watcher)try{
        watcher=new win.CloseWatcher();
        watcher.addEventListener('close',()=>{
          watcher=null;if(dismiss())queueMicrotask(sync);
        },{once:true});
      }catch{ /* Browsers may limit watchers without a user activation. */ }
      if(watcher)return;
    }
    // One same-URL step makes system Back dismiss the tray on browsers without
    // CloseWatcher. A different URL remains an ordinary map/spot navigation.
    if(historyFrame?.href!==win.location.href)historyFrame=null;
    if(!historyFrame){
      const frame={href:win.location.href,retiring:false};
      try{win.history.pushState({...win.history.state,pinchHud:token},'',frame.href);historyFrame=frame;}catch{}
    }
  }
  listen(win,'popstate',event=>{
    if(win.history.state?.pinchHud===token){
      historyFrame={href:win.location.href,retiring:false,navigation:true};
      return; // Let the normal route restore a previous area or shared stop.
    }
    const frame=historyFrame;
    if(!frame)return;
    historyFrame=null;
    if(win.location.href!==frame.href){expanded=false;sync(false);return;}
    event.stopImmediatePropagation();
    if(!frame.retiring)dismiss();
    queueMicrotask(sync);
  },true);
  function sync(back=true){
    if(closed || !active)return;
    if(previousView==='list' && !inList())expanded=false;
    previousView=app.dataset.view;
    const details=inDetail(),open=expanded || inList();
    if(details && !hadDetails && tray.contains(doc.activeElement))doc.activeElement.blur?.();
    hadDetails=details;
    app.dataset.hudTray=open?'open':'closed';
    handle.setAttribute('aria-expanded',String(open));
    handle.setAttribute('aria-label',open?'Collapse stops and filters':'Expand stops and filters');
    tray.inert=details;
    mapRegion.inert=inList();
    measure();if(back)syncBack();
  }
  function layout(){
    if(active===query.matches){sync();return;}
    active=query.matches;expanded=false;
    if(active){
      app.dataset.mobileHud='true';bar.hidden=false;slot.append(nav);sync();
    }else{
      delete app.dataset.mobileHud;delete app.dataset.hudTray;
      bar.hidden=true;home.after(nav);tray.inert=false;mapRegion.inert=false;
      forgetWatcher();releaseHistory();
      for(const key of ['--hud-visible-height','--hud-keyboard-inset','--hud-tray-height'])app.style.removeProperty(key);
    }
  }
  listen(handle,'click',()=>{
    if(!active)return;
    if(skipClick){skipClick=false;return;}
    if(inList()){setView?.('map');setExpanded(false);return;}
    setExpanded(!expanded,{focus:true});
  });
  // Swipe only on the handle. List scrolling and map dragging retain their
  // normal gestures, and every swipe has a native keyboard/button equivalent.
  listen(handle,'pointerdown',event=>{
    if(!active || event.button!==0)return;
    skipClick=false;swipe={id:event.pointerId,y:event.clientY};handle.setPointerCapture?.(event.pointerId);
  });
  listen(handle,'pointerup',event=>{
    if(!swipe || swipe.id!==event.pointerId)return;
    const delta=event.clientY-swipe.y;swipe=null;
    if(Math.abs(delta)<32)return;
    skipClick=true;
    if(delta>0 && inList())setView?.('map');
    setExpanded(delta<0,{focus:true});
  });
  listen(handle,'pointercancel',()=>{swipe=null;skipClick=false;});
  listen(search,'focus',()=>{if(active && !inList() && !inDetail())setExpanded(true);});
  listen(doc,'atlasboundsrequest',()=>{
    if(!active || inList() || (!expanded && app.dataset.hudTray!=='open'))return;
    if(historyFrame)historyFrame.navigation=true;
    expanded=false;tray.scrollTop=0;
    if(doc.activeElement===search)search.blur();
    sync(false);
    if(!needsBack())forgetWatcher();
  });
  listen(doc,'keydown',event=>{
    if(event.key!=='Escape' || !needsBack() || hasModal())return;
    if(dismiss()){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  listen(query,'change',layout);
  listen(viewport,'resize',measure);listen(viewport,'scroll',measure);
  const mutations=new win.MutationObserver(()=>sync());
  mutations.observe(app,{attributes:true,attributeFilter:['data-view','class']});
  const resize=new win.ResizeObserver(measure);resize.observe(tray);
  layout();
  return {sync,dispose(){
    closed=true;active=false;forgetWatcher();releaseHistory();
    remove.forEach(fn=>fn());mutations.disconnect();resize.disconnect();home.after(nav);home.remove();
    bar.hidden=true;tray.inert=false;mapRegion.inert=false;delete app.dataset.mobileHud;delete app.dataset.hudTray;
    for(const key of ['--hud-visible-height','--hud-keyboard-inset','--hud-tray-height'])app.style.removeProperty(key);
  }};
}
