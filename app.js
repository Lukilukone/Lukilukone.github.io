(() => {
  'use strict';

  // ---------------------------------------------------------------
  // Storage layer (localStorage, with safe JSON helpers)
  // ---------------------------------------------------------------
  const LS_PROJECTS = 'portfolio:projects';
  const lsImagesKey = (projectId) => `portfolio:images:${projectId}`;
  const lsImageDataKey = (projectId, imageId) => `portfolio:image:${projectId}:${imageId}`;

  function lsGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Resize + compress an image file to a JPEG data URL.
  function resizeImage(file, maxDim = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      reader.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------
  let projects = [];       // [{id, name, createdAt, count, cover}]
  let currentId = null;
  let images = [];         // current gallery: [{id, name, createdAt, data}]
  let lightboxIndex = null;
  let dragCounter = 0;

  // ---------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  const viewHome = $('view-home');
  const viewGallery = $('view-gallery');
  const folderGrid = $('folder-grid');
  const homeMeta = $('home-meta');
  const homeEmptyHint = $('home-empty-hint');

  const galleryTitle = $('gallery-title');
  const galleryMeta = $('gallery-meta');
  const imageGrid = $('image-grid');
  const dropzone = $('dropzone');
  const dropzoneText = $('dropzone-text');
  const dropzoneIcon = $('dropzone-icon');
  const uploadProgressEl = $('upload-progress');
  const fileInput = $('file-input');

  const lightbox = $('lightbox');
  const lbImage = $('lb-image');
  const lbCaption = $('lb-caption');

  const confirmOverlay = $('confirm-overlay');
  const confirmTitle = $('confirm-title');
  const confirmMessage = $('confirm-message');

  const toast = $('toast');

  // ---------------------------------------------------------------
  // Persistence: load / save project list
  // ---------------------------------------------------------------
  function loadProjectsList() {
    const list = lsGet(LS_PROJECTS) || [];
    return list.map((p) => {
      const meta = lsGet(lsImagesKey(p.id)) || [];
      let cover = null;
      if (meta.length > 0) cover = lsGet(lsImageDataKey(p.id, meta[0].id));
      return { ...p, count: meta.length, cover };
    });
  }

  function saveProjectsList() {
    const slim = projects.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
    const ok = lsSet(LS_PROJECTS, slim);
    if (!ok) showToast();
  }

  function showToast() {
    toast.hidden = false;
  }

  // ---------------------------------------------------------------
  // Rendering: HOME view
  // ---------------------------------------------------------------
  function renderHome() {
    homeMeta.textContent = `${projects.length} ${projects.length === 1 ? 'Mappe' : 'Mappen'} · Kontaktbogen-Index`;
    homeEmptyHint.hidden = projects.length !== 0;

    folderGrid.innerHTML = '';

    projects.forEach((p, i) => {
      folderGrid.appendChild(buildFolderCard(p, i));
    });

    folderGrid.appendChild(buildNewFolderCard(projects.length));
  }

  function buildFolderCard(project, index) {
    const num = String(index + 1).padStart(2, '0');
    const card = document.createElement('div');
    card.className = 'folder-card fade-in';

    const thumbInner = project.cover
      ? `<img src="${project.cover}" alt="">`
      : `<div class="folder-thumb-empty">
           <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M3 3l18 18M21 15V5a2 2 0 00-2-2H8M3 9v10a2 2 0 002 2h10M9 13a2 2 0 100-4 2 2 0 000 4z"/></svg>
           <span>leere Rolle</span>
         </div>`;

    card.innerHTML = `
      <button class="folder-thumb" data-action="open">
        ${thumbInner}
        <span class="tag-num">Nº ${num}</span>
      </button>
      <div class="folder-meta-row">
        <div style="flex:1; min-width:0;">
          <h3 class="folder-name" data-action="rename" title="Klicken, um den Namen zu ändern">${escapeHtml(project.name)}</h3>
          <p class="folder-count">${project.count} ${project.count === 1 ? 'Bild' : 'Bilder'}</p>
        </div>
        <div class="folder-actions">
          <button class="icon-btn" data-action="rename" aria-label="Umbenennen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
          <button class="icon-btn" data-action="delete" aria-label="Mappe löschen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector('[data-action="open"]').addEventListener('click', () => openProject(project.id));
    card.querySelectorAll('[data-action="rename"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        startRenameFolderCard(card, project);
      });
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      requestDeleteProject(project);
    });

    return card;
  }

  function startRenameFolderCard(card, project) {
    const nameEl = card.querySelector('.folder-name');
    const input = document.createElement('input');
    input.className = 'name-input folder-name-input';
    input.value = project.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const trimmed = input.value.trim();
      if (trimmed && trimmed !== project.name) {
        renameProject(project.id, trimmed);
      } else {
        renderHome();
      }
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') renderHome();
    });
  }

  function buildNewFolderCard(index) {
    const num = String(index + 1).padStart(2, '0');
    const wrap = document.createElement('div');
    wrap.className = 'new-folder-card';
    wrap.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M12 5v14M5 12h14"/></svg>
      <span>Neue Mappe</span>
    `;

    wrap.addEventListener('click', () => {
      wrap.className = 'new-folder-card active';
      wrap.innerHTML = `
        <span class="new-folder-num">Nº ${num}</span>
        <input class="new-folder-input" placeholder="Name der Mappe" />
        <div class="new-folder-actions">
          <button class="btn-accent btn-small" data-action="create">Erstellen</button>
          <button class="btn-ghost btn-small" data-action="cancel">Abbrechen</button>
        </div>
      `;
      const input = wrap.querySelector('.new-folder-input');
      input.focus();

      const submit = () => {
        const trimmed = input.value.trim();
        if (trimmed) createProject(trimmed);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') renderHome();
      });
      wrap.querySelector('[data-action="create"]').addEventListener('click', submit);
      wrap.querySelector('[data-action="cancel"]').addEventListener('click', renderHome);
    }, { once: false });

    return wrap;
  }

  // ---------------------------------------------------------------
  // Project actions
  // ---------------------------------------------------------------
  function createProject(name) {
    const project = { id: uid(), name: name.trim(), createdAt: Date.now(), count: 0, cover: null };
    projects.push(project);
    saveProjectsList();
    openProject(project.id);
  }

  function renameProject(id, name) {
    const p = projects.find((p) => p.id === id);
    if (p) p.name = name;
    saveProjectsList();
    if (currentId === id) renderGalleryHeader();
    else renderHome();
  }

  function requestDeleteProject(project) {
    showConfirm(
      'Mappe löschen?',
      `„${project.name}“ und alle ${project.count} enthaltenen Bilder werden dauerhaft gelöscht.`,
      () => deleteProject(project.id)
    );
  }

  function deleteProject(id) {
    const meta = lsGet(lsImagesKey(id)) || [];
    meta.forEach((m) => lsRemove(lsImageDataKey(id, m.id)));
    lsRemove(lsImagesKey(id));

    projects = projects.filter((p) => p.id !== id);
    saveProjectsList();

    if (currentId === id) {
      goHome();
    } else {
      renderHome();
    }
  }

  // ---------------------------------------------------------------
  // Gallery: open / navigation
  // ---------------------------------------------------------------
  function openProject(id) {
    currentId = id;
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    const meta = lsGet(lsImagesKey(id)) || [];
    images = meta.map((m) => ({ ...m, data: lsGet(lsImageDataKey(id, m.id)) })).filter((img) => img.data);

    viewHome.hidden = true;
    viewGallery.hidden = false;
    viewGallery.classList.add('fade-in');

    renderGalleryHeader();
    renderImageGrid();
  }

  function goHome() {
    currentId = null;
    images = [];
    viewGallery.hidden = true;
    viewHome.hidden = false;
    viewHome.classList.add('fade-in');
    projects = loadProjectsList();
    renderHome();
  }

  function currentProject() {
    return projects.find((p) => p.id === currentId);
  }

  function renderGalleryHeader() {
    const project = currentProject();
    if (!project) return;
    galleryTitle.innerHTML = `${escapeHtml(project.name)} <svg class="pencil-hint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
    galleryMeta.textContent = `${images.length} ${images.length === 1 ? 'Bild' : 'Bilder'}`;
  }

  function startRenameGalleryTitle() {
    const project = currentProject();
    if (!project) return;
    const input = document.createElement('input');
    input.className = 'name-input gallery-title-input';
    input.value = project.name;
    galleryTitle.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const trimmed = input.value.trim();
      if (trimmed && trimmed !== project.name) {
        renameProject(project.id, trimmed);
        input.replaceWith(galleryTitle);
      } else {
        input.replaceWith(galleryTitle);
      }
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { input.replaceWith(galleryTitle); }
    });
  }

  // ---------------------------------------------------------------
  // Gallery: image grid rendering
  // ---------------------------------------------------------------
  function renderImageGrid() {
    imageGrid.innerHTML = '';

    if (images.length === 0) {
      dropzone.classList.add('empty');
      dropzoneText.textContent = 'Noch keine Bilder in dieser Mappe — hierher ziehen oder klicken, um hochzuladen';
      dropzoneIcon.setAttribute('width', '26');
      dropzoneIcon.setAttribute('height', '26');
    } else {
      dropzone.classList.remove('empty');
      dropzoneText.textContent = 'Weitere Bilder hierher ziehen oder klicken';
      dropzoneIcon.setAttribute('width', '18');
      dropzoneIcon.setAttribute('height', '18');
    }

    images.forEach((img, i) => {
      imageGrid.appendChild(buildImageTile(img, i));
    });
  }

  function buildImageTile(image, index) {
    const num = String(index + 1).padStart(2, '0');
    const isCover = index === 0;
    const tile = document.createElement('div');
    tile.className = 'image-tile fade-in';
    tile.innerHTML = `
      <button class="image-thumb" data-action="open">
        <img src="${image.data}" alt="${escapeHtml(image.name)}">
        <span class="tag-num">Nº ${num}</span>
        ${isCover ? `<span class="cover-badge" title="Titelbild">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </span>` : ''}
      </button>
      <div class="tile-actions">
        ${!isCover ? `<button data-action="cover" aria-label="Als Titelbild festlegen" title="Als Titelbild festlegen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>` : ''}
        <button data-action="delete" aria-label="Bild löschen" title="Bild löschen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
        </button>
      </div>
    `;

    tile.querySelector('[data-action="open"]').addEventListener('click', () => openLightbox(index));
    const coverBtn = tile.querySelector('[data-action="cover"]');
    if (coverBtn) coverBtn.addEventListener('click', (e) => { e.stopPropagation(); setAsCover(image.id); });
    tile.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      requestDeleteImage(image);
    });

    return tile;
  }

  // ---------------------------------------------------------------
  // Upload handling
  // ---------------------------------------------------------------
  async function handleFiles(fileList) {
    if (!currentId) return;
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    uploadProgressEl.hidden = false;
    uploadProgressEl.textContent = `Lade hoch … 0/${files.length}`;

    const meta = lsGet(lsImagesKey(currentId)) || [];
    let anyFail = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const dataUrl = await resizeImage(file);
        const id = uid();
        const ok = lsSet(lsImageDataKey(currentId, id), dataUrl);
        if (ok) {
          const entry = { id, name: file.name, createdAt: Date.now() };
          meta.push(entry);
          images.push({ ...entry, data: dataUrl });
        } else {
          anyFail = true;
        }
      } catch (e) {
        console.error(e);
      }
      uploadProgressEl.textContent = `Lade hoch … ${i + 1}/${files.length}`;
    }

    lsSet(lsImagesKey(currentId), meta);
    if (anyFail) showToast();

    const project = currentProject();
    if (project) {
      project.count = meta.length;
      if (!project.cover && images[0]) project.cover = images[0].data;
    }

    uploadProgressEl.hidden = true;
    renderGalleryHeader();
    renderImageGrid();
  }

  // ---------------------------------------------------------------
  // Image actions
  // ---------------------------------------------------------------
  function requestDeleteImage(image) {
    showConfirm(
      'Bild löschen?',
      `„${image.name}“ wird dauerhaft aus dieser Mappe entfernt.`,
      () => deleteImage(image.id)
    );
  }

  function deleteImage(imageId) {
    lsRemove(lsImageDataKey(currentId, imageId));
    images = images.filter((img) => img.id !== imageId);

    const meta = images.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
    lsSet(lsImagesKey(currentId), meta);

    const project = currentProject();
    if (project) {
      project.count = images.length;
      project.cover = images[0] ? images[0].data : null;
    }

    if (lightboxIndex !== null) {
      if (images.length === 0) {
        closeLightbox();
      } else {
        lightboxIndex = Math.min(lightboxIndex, images.length - 1);
        renderLightbox();
      }
    }

    renderGalleryHeader();
    renderImageGrid();
  }

  function setAsCover(imageId) {
    const idx = images.findIndex((img) => img.id === imageId);
    if (idx <= 0) return;
    const [picked] = images.splice(idx, 1);
    images.unshift(picked);

    const meta = images.map(({ id, name, createdAt }) => ({ id, name, createdAt }));
    lsSet(lsImagesKey(currentId), meta);

    const project = currentProject();
    if (project) project.cover = images[0].data;

    renderImageGrid();
  }

  // ---------------------------------------------------------------
  // Lightbox
  // ---------------------------------------------------------------
  function openLightbox(index) {
    lightboxIndex = index;
    lightbox.hidden = false;
    renderLightbox();
  }

  function closeLightbox() {
    lightboxIndex = null;
    lightbox.hidden = true;
  }

  function lightboxPrev() {
    if (lightboxIndex === null || images.length === 0) return;
    lightboxIndex = (lightboxIndex - 1 + images.length) % images.length;
    renderLightbox();
  }

  function lightboxNext() {
    if (lightboxIndex === null || images.length === 0) return;
    lightboxIndex = (lightboxIndex + 1) % images.length;
    renderLightbox();
  }

  function renderLightbox() {
    const img = images[lightboxIndex];
    if (!img) { closeLightbox(); return; }
    lbImage.src = img.data;
    lbImage.alt = img.name;
    const num = String(lightboxIndex + 1).padStart(2, '0');
    const total = String(images.length).padStart(2, '0');
    lbCaption.innerHTML = `<span class="lb-index">Nº ${num}</span> / ${total}<span class="lb-name">${escapeHtml(img.name)}</span>`;
  }

  // ---------------------------------------------------------------
  // Confirm dialog
  // ---------------------------------------------------------------
  let pendingConfirmAction = null;

  function showConfirm(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    confirmOverlay.hidden = false;
  }

  function hideConfirm() {
    confirmOverlay.hidden = true;
    pendingConfirmAction = null;
  }

  // ---------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------
  $('btn-back').addEventListener('click', goHome);
  galleryTitle.addEventListener('click', startRenameGalleryTitle);

  $('btn-upload-trigger').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  });

  $('lb-close').addEventListener('click', closeLightbox);
  $('lb-prev').addEventListener('click', lightboxPrev);
  $('lb-next').addEventListener('click', lightboxNext);
  $('lb-delete').addEventListener('click', () => {
    const img = images[lightboxIndex];
    if (img) requestDeleteImage(img);
  });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  });

  $('confirm-cancel').addEventListener('click', hideConfirm);
  $('confirm-ok').addEventListener('click', () => {
    const action = pendingConfirmAction;
    hideConfirm();
    if (action) action();
  });
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) hideConfirm();
  });

  $('toast-close').addEventListener('click', () => { toast.hidden = true; });

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  projects = loadProjectsList();
  renderHome();
})();
