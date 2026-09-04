(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function cardWith(selector) {
    return $(selector)?.closest('.card') || null;
  }

  function el(tag, cls, html = '') {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html) node.innerHTML = html;
    return node;
  }

  function boot() {
    if (!document.body || document.body.dataset.capcutUi === '1') return;

    const container = $('.container');
    const grid = $('.grid');
    const inputCard = cardWith('#dropZone');
    const opsCard = cardWith('.ops-grid');
    const outputCard = cardWith('#outEmpty');
    const trimCard = $('#trimCard');
    const inputWrap = $('#inputWrap');
    const statusbar = $('.statusbar');

    if (!container || !grid || !inputCard || !opsCard || !trimCard) return;

    document.body.dataset.capcutUi = '1';
    document.documentElement.classList.add('cc-enabled');

    // Brand/header: preserve existing controls and ids, only change presentation.
    const header = $('header');
    if (header) {
      const title = $('h1', header);
      if (title) title.textContent = 'Video Studio';
      const pill = $('.pill', header);
      if (pill) pill.textContent = 'LOCAL EDITOR';
      const gh = $('.gh-link', header);
      if (gh) {
        gh.href = 'https://github.com/Gamevalentine/ffmpeg-webCLI';
        const span = $('span', gh);
        if (span) span.textContent = 'Source';
      }
    }

    const shell = el('main', 'cc-shell');
    const workspace = el('section', 'cc-workspace');
    const rail = el('nav', 'cc-rail');
    const library = el('aside', 'cc-library');
    const center = el('section', 'cc-center');
    const inspector = el('aside', 'cc-inspector');
    const timeline = el('section', 'cc-timeline');

    const railItems = [
      ['media', 'fa-photo-film', 'Media'],
      ['edit', 'fa-sliders', 'Edit'],
      ['audio', 'fa-music', 'Audio'],
      ['captions', 'fa-closed-captioning', 'Captions'],
      ['overlay', 'fa-layer-group', 'Overlay'],
      ['more', 'fa-ellipsis', 'More'],
    ];

    railItems.forEach(([key, icon, label], i) => {
      const b = el('button', `cc-rail-btn${i === 0 ? ' active' : ''}`,
        `<i class="fas ${icon}"></i><span>${label}</span>`);
      b.type = 'button';
      b.dataset.section = key;
      rail.appendChild(b);
    });

    const libHead = el('div', 'cc-panel-head', '<strong>Media</strong><span>Local files</span>');
    library.appendChild(libHead);
    library.appendChild(inputCard);

    const preview = el('div', 'cc-preview');
    const previewTop = el('div', 'cc-preview-top',
      '<span class="cc-preview-title">Preview</span><span class="cc-preview-badge"><i class="fas fa-lock"></i> 100% local</span>');
    const stage = el('div', 'cc-stage');
    const empty = el('div', 'cc-stage-empty',
      '<i class="fas fa-clapperboard"></i><strong>Add a video to start editing</strong><span>Choose a file from Media</span>');
    stage.appendChild(empty);
    if (inputWrap) stage.appendChild(inputWrap);
    preview.append(previewTop, stage);

    const transport = el('div', 'cc-transport');
    transport.innerHTML = `
      <button type="button" id="ccBack" title="Back 5 seconds"><i class="fas fa-backward-step"></i></button>
      <button type="button" id="ccPlay" class="cc-play" title="Play/Pause"><i class="fas fa-play"></i></button>
      <button type="button" id="ccForward" title="Forward 5 seconds"><i class="fas fa-forward-step"></i></button>
      <span id="ccTime">00:00 / 00:00</span>
      <span class="cc-spacer"></span>
      <button type="button" id="ccFit" title="Fit preview"><i class="fas fa-expand"></i></button>`;
    preview.appendChild(transport);

    center.appendChild(preview);

    const inspectorHead = el('div', 'cc-inspector-head');
    inspectorHead.innerHTML = `
      <div class="cc-tabs">
        <button type="button" class="active" data-tab="edit">Edit</button>
        <button type="button" data-tab="output">Output</button>
      </div>
      <button type="button" id="ccExport" class="cc-export" disabled><i class="fas fa-arrow-up-from-bracket"></i> Export</button>`;
    inspector.appendChild(inspectorHead);
    const inspectorBody = el('div', 'cc-inspector-body');
    inspectorBody.appendChild(opsCard);
    if (outputCard) inspectorBody.appendChild(outputCard);
    inspector.appendChild(inspectorBody);

    const timelineHead = el('div', 'cc-timeline-head',
      '<div><strong>Timeline</strong><span>Trim the selected clip</span></div><div class="cc-timeline-tools"><button type="button" id="ccZoomOut" title="Zoom out"><i class="fas fa-minus"></i></button><button type="button" id="ccZoomIn" title="Zoom in"><i class="fas fa-plus"></i></button></div>');
    timeline.append(timelineHead, trimCard);

    workspace.append(rail, library, center, inspector);
    shell.append(workspace, timeline);

    // Keep status/loading state above the editor.
    if (statusbar) shell.prepend(statusbar);
    container.prepend(shell);

    // Hide the now-empty legacy grid; keep any other cards below for diagnostics.
    grid.classList.add('cc-legacy-grid');

    // Move remaining top-level diagnostic cards into a collapsible drawer.
    const remainingCards = [...container.children].filter(n => n !== shell && n !== grid && n.classList?.contains('card'));
    if (remainingCards.length) {
      const details = el('details', 'cc-diagnostics');
      const summary = el('summary', '', '<i class="fas fa-terminal"></i> Diagnostics');
      details.appendChild(summary);
      remainingCards.forEach(c => details.appendChild(c));
      shell.appendChild(details);
    }

    const categories = {
      media: [],
      edit: ['convert','resizecompress','speed','rotate','crop','thumbnail','reverse','fade','adjust','gif','pad','denoise','boomerang','sharpenblur'],
      audio: ['audio','mute','volume','mixaudio','normalize'],
      captions: ['autocaption','subtitles'],
      overlay: ['overlay','concat','sxs','pip'],
      more: ['stripmeta','info','loop','raw'],
    };

    function filterOps(section) {
      $$('.cc-rail-btn').forEach(b => b.classList.toggle('active', b.dataset.section === section));
      const headStrong = $('.cc-panel-head strong');
      const headSub = $('.cc-panel-head span');
      const titles = { media:'Media', edit:'Edit tools', audio:'Audio', captions:'Captions', overlay:'Overlay', more:'More tools' };
      if (headStrong) headStrong.textContent = titles[section] || 'Media';
      if (headSub) headSub.textContent = section === 'media' ? 'Local files' : 'Choose a tool on the right';

      library.classList.toggle('cc-library-muted', section !== 'media');
      const allowed = categories[section] || [];
      $$('.op-tile', opsCard).forEach(tile => {
        if (section === 'media') {
          tile.classList.remove('cc-filtered');
          return;
        }
        const key = tile.id.replace(/^op-/, '');
        tile.classList.toggle('cc-filtered', !allowed.includes(key));
      });
      switchInspector('edit');
    }

    $$('.cc-rail-btn').forEach(b => b.addEventListener('click', () => filterOps(b.dataset.section)));

    function switchInspector(tab) {
      const showOutput = tab === 'output';
      $$('.cc-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      opsCard.style.display = showOutput ? 'none' : '';
      if (outputCard) outputCard.style.display = showOutput ? '' : 'none';
    }

    $$('.cc-tabs button').forEach(b => b.addEventListener('click', () => switchInspector(b.dataset.tab)));
    switchInspector('edit');

    // Preview transport reuses the existing input video, so no duplicate media pipeline is created.
    const video = $('#inputVideo');
    const playBtn = $('#ccPlay');
    const time = $('#ccTime');
    const fmt = s => {
      if (!Number.isFinite(s)) return '00:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    };

    function syncPreview() {
      const loaded = inputWrap && !inputWrap.classList.contains('hidden');
      empty.classList.toggle('hidden', !!loaded);
      if (loaded && video) time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
      else time.textContent = '00:00 / 00:00';
    }

    if (video) {
      video.addEventListener('timeupdate', syncPreview);
      video.addEventListener('loadedmetadata', syncPreview);
      video.addEventListener('play', () => { if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i>'; });
      video.addEventListener('pause', () => { if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>'; });
      $('#ccPlay')?.addEventListener('click', () => video.paused ? video.play() : video.pause());
      $('#ccBack')?.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 5); });
      $('#ccForward')?.addEventListener('click', () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); });
      $('#ccFit')?.addEventListener('click', () => stage.classList.toggle('cc-contain-tight'));
    }

    if (inputWrap) new MutationObserver(syncPreview).observe(inputWrap, { attributes:true, attributeFilter:['class'] });
    syncPreview();

    // Timeline zoom only changes visual scale, never clip timing or FFmpeg arguments.
    let zoom = 1;
    const applyZoom = () => timeline.style.setProperty('--cc-tl-zoom', zoom);
    $('#ccZoomIn')?.addEventListener('click', () => { zoom = Math.min(2.5, +(zoom + .25).toFixed(2)); applyZoom(); });
    $('#ccZoomOut')?.addEventListener('click', () => { zoom = Math.max(.75, +(zoom - .25).toFixed(2)); applyZoom(); });

    // Top Export delegates to the existing tested processing buttons.
    const exportBtn = $('#ccExport');
    const process = $('#processBtn');
    const processStack = $('#processStackBtn');
    const modeStack = $('#modeStack');

    function activeProcessButton() {
      return modeStack?.classList.contains('active') ? processStack : process;
    }
    function syncExport() {
      const target = activeProcessButton();
      if (!exportBtn || !target) return;
      exportBtn.disabled = target.disabled || target.classList.contains('hidden');
    }
    exportBtn?.addEventListener('click', () => activeProcessButton()?.click());
    [process, processStack, modeStack].filter(Boolean).forEach(n => new MutationObserver(syncExport).observe(n, {attributes:true, attributeFilter:['disabled','class']}));
    syncExport();

    // Automatically reveal output when processing finishes.
    const outContent = $('#outContent');
    if (outContent) {
      new MutationObserver(() => {
        if (!outContent.classList.contains('hidden')) switchInspector('output');
      }).observe(outContent, {attributes:true, attributeFilter:['class']});
    }

    // Make the operation panel read like an inspector instead of a button matrix.
    const opsHeader = $('.card-header', opsCard);
    if (opsHeader) opsHeader.textContent = 'Tools';
    const outputHeader = outputCard && $('.card-header', outputCard);
    if (outputHeader) outputHeader.textContent = 'Preview output';

    filterOps('media');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
