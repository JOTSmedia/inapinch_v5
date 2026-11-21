// Posters remain visible until an eligible, muted clip actually starts playing.
export function createOcean() {
  const region = document.querySelector('.map-region');
  const app = document.getElementById('app');
  if (!region || !app) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedData = window.matchMedia('(prefers-reduced-data: reduce)');
  const connection = window.navigator?.connection;
  let pageActive = true;

  function makeFootage(className, name, mount) {
    const container = document.createElement('div');
    container.className = className;
    container.inert = true;
    container.setAttribute('aria-hidden', 'true');
    const video = document.createElement('video');
    video.className = 'background-video';
    video.hidden = true;
    video.muted = video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.controls = false;
    video.disablePictureInPicture = video.disableRemotePlayback = true;
    video.preload = 'none';
    video.poster = 'assets/' + name + '-poster.jpg';
    for (const attribute of ['muted','playsinline','disablepictureinpicture','disableremoteplayback']) {
      video.setAttribute(attribute, '');
    }
    video.setAttribute('x-webkit-airplay', 'deny');
    container.append(video);
    mount(container);
    return {
      video, container, src:'assets/' + name + '.mp4', visible:!('IntersectionObserver' in window),
      wanted:false, revision:0, pending:false, blocked:false, failed:false
    };
  }

  const clips = [
    makeFootage('site-backdrop','key-west-background',container=>app.before(container)),
    makeFootage('ocean-footage','ocean-water',container=>region.prepend(container))
  ];

  function mayPlay(clip) {
    if (app.dataset?.view === 'list' && window.matchMedia('(max-width: 760px)').matches) return false;
    if (!pageActive || motion.matches || reducedData.matches || connection?.saveData || document.hidden || document.body.dataset.city!=='key-west' || !clip.visible || clip.failed) return false;
    const css = getComputedStyle(clip.container);
    return css.display!=='none' && css.visibility!=='hidden';
  }

  async function syncClip(clip) {
    const {video} = clip;
    const wanted = mayPlay(clip);
    if (clip.wanted !== wanted) {
      clip.wanted = wanted;
      clip.revision++;
      clip.blocked = false;
    }
    if (!wanted) {
      video.hidden = true;
      if (!video.paused || clip.pending) video.pause();
      return;
    }
    if (clip.blocked || clip.pending) return;
    if (!video.paused) {video.hidden = false;return;}
    const revision = clip.revision;
    clip.pending = true;
    try {
      // Inline Safari playback needs a displayed element. Its own poster covers startup.
      video.hidden = false;
      if (!video.getAttribute('src')) video.src = clip.src;
      await video.play();
      if (mayPlay(clip) && revision===clip.revision) video.hidden = false;
      else {video.hidden=true;video.pause();}
    } catch {
      video.hidden = true;
      // Retry only on a later eligibility transition. A denied play keeps its poster.
      if (revision===clip.revision) clip.blocked = true;
    } finally {
      clip.pending = false;
      if (revision!==clip.revision) void syncClip(clip);
    }
  }

  const sync = () => {for (const clip of clips) void syncClip(clip);};
  for (const clip of clips) {
    clip.video.addEventListener('error',()=>{
      clip.failed=true;
      void syncClip(clip);
    });
  }
  motion.addEventListener('change',sync);
  reducedData.addEventListener('change',sync);
  connection?.addEventListener?.('change',sync);
  document.addEventListener('areathemechange',sync);
  document.addEventListener('keywestsurfacechange',sync);
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('citychange',sync);
  document.addEventListener('mapstylechange',sync);
  window.addEventListener('pagehide',()=>{pageActive=false;sync();});
  window.addEventListener('pageshow',()=>{pageActive=true;sync();});
  new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['data-view']});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries=>{
      for (const entry of entries) {
        const clip = clips.find(item=>item.container===entry.target);
        if (!clip) continue;
        clip.visible = entry.isIntersecting;
        void syncClip(clip);
      }
    });
    for (const clip of clips) observer.observe(clip.container);
  }
  sync();
}
