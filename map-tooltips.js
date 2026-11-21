// Keep Leaflet's native marker/polygon anchors and world-copy positioning.
// Fit only the painted label to the visible map, including when the desktop
// sidebar leaves a canvas much narrower than the browser window.
export function attachMapTooltips(map) {
  const container=map?.getContainer?.(), win=container?.ownerDocument?.defaultView;
  if(!map?.on || !container?.getBoundingClientRect || !win?.requestAnimationFrame)return ()=>{};
  const open=new Map();
  let frame=0,mapWidth=0;

  function sizeLabels() {
    const width=Math.floor(container.getBoundingClientRect().width);
    if(width>0 && width!==mapWidth){
      mapWidth=width;
      container.style.setProperty('--tooltip-map-width',width+'px');
      for(const tooltip of open.keys())tooltip.update();
    }
  }
  function fitLabels(){
    frame=0;
    const bounds=container.getBoundingClientRect();
    if(!bounds.width || !bounds.height)return;
    for(const [tooltip,shift] of open){
      const node=tooltip.getElement();
      const anchor=map.latLngToContainerPoint(tooltip.getLatLng());
      const outside=anchor.x<0 || anchor.y<0 || anchor.x>bounds.width || anchor.y>bounds.height;
      node.toggleAttribute('data-anchor-outside',outside);
      if(outside)continue;
      const box=node.getBoundingClientRect();
      if(!box.width || !box.height)continue;
      const left=box.left-bounds.left-shift.x,top=box.top-bounds.top-shift.y;
      const inset=8;
      const fit=(start,length,available)=>Math.max(inset,Math.min(start,available-length-inset));
      let desiredTop=top;
      if(top<inset && node.classList.contains('leaflet-tooltip-top') && anchor.y+inset+box.height<=bounds.height-inset){
        desiredTop=anchor.y+inset;
      }
      const x=Math.round(fit(left,box.width,bounds.width)-left);
      const y=Math.round(fit(desiredTop,box.height,bounds.height)-top);
      if(x!==shift.x){node.style.setProperty('--tooltip-shift-x',x+'px');shift.x=x;}
      if(y!==shift.y){node.style.setProperty('--tooltip-shift-y',y+'px');shift.y=y;}
      const arrow=Math.round(Math.max(8,Math.min(box.width-8,anchor.x-left-x)));
      node.style.setProperty('--tooltip-arrow-x',arrow+'px');
      // Once the bubble moves off its original side an arrow can point to a
      // different facility. The geographic marker still shows the anchor.
      node.toggleAttribute('data-edge-fit',Boolean(y || (x &&
        (node.classList.contains('leaflet-tooltip-left') || node.classList.contains('leaflet-tooltip-right')))));
    }
  }
  function schedule(){
    if(open.size && !frame)frame=win.requestAnimationFrame(fitLabels);
  }
  function opened(event){
    const tooltip=event.tooltip;
    if(!tooltip?.getElement?.() || open.has(tooltip))return;
    sizeLabels();
    open.set(tooltip,{x:0,y:0});
    schedule();
  }
  function closed(event){
    const tooltip=event.tooltip,node=tooltip?.getElement?.();
    open.delete(tooltip);
    if(node){
      for(const prop of ['--tooltip-shift-x','--tooltip-shift-y','--tooltip-arrow-x'])node.style.removeProperty(prop);
      node.removeAttribute('data-edge-fit');
      node.removeAttribute('data-anchor-outside');
    }
  }
  function resized(){sizeLabels();schedule();}
  function detach(){
    map.off('tooltipopen',opened);map.off('tooltipclose',closed);map.off('resize',resized);
    map.off('mousemove move zoom viewreset',schedule);map.off('unload',detach);
    if(frame)win.cancelAnimationFrame(frame);
    for(const tooltip of open.keys())closed({tooltip});
    container.style.removeProperty('--tooltip-map-width');
  }
  sizeLabels();
  map.on('tooltipopen',opened);map.on('tooltipclose',closed);map.on('resize',resized);
  map.on('mousemove move zoom viewreset',schedule);map.on('unload',detach);
  return detach;
}
