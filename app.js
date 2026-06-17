(() => {
  'use strict';

  // ---------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------
  let projects = [];       // Geladen aus portfolio.json
  let currentId = null;
  let images = [];         // Bilder der aktuell geöffneten Mappe
  let lightboxIndex = null;

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

  const lightbox = $('lightbox');
  const lbImage = $('lb-image');
  const lbCaption = $('lb-caption');
  const lbSpinner = $('lb-spinner');

  const toast = $('toast');
  const toastText = $('toast-text');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    if (message) toastText.textContent = message;
    toast.hidden = false;
  }

  // ---------------------------------------------------------------
  // Daten laden von GitHub
  // ---------------------------------------------------------------
  async function initApp() {
    try {
      // Lädt die JSON-Datei relativ zum Speicherort der app.js
      const response = await fetch('portfolio.json');
      if (!response.ok) throw new Error('portfolio.json konnte nicht geladen werden');
      
      projects = await response.json();
      renderHome();
    } catch (error) {
      console.error(error);
      homeMeta.textContent = "Fehler beim Laden des Portfolios";
      homeEmptyHint.hidden = false;
      homeEmptyHint.textContent = "Die portfolio.json konnte nicht geladen oder verarbeitet werden.";
    }
  }

  // ---------------------------------------------------------------
  // Rendering: HOME view
  // ---------------------------------------------------------------
  function renderHome() {
    homeMeta.textContent = `${projects.length} ${projects.length === 1 ? 'Mappe' : 'Mappen'} · Index`;
    homeEmptyHint.hidden = projects.length !== 0;

    folderGrid.innerHTML = '';

    projects.forEach((p, i) => {
      folderGrid.appendChild(buildFolderCard(p, i));
    });
  }

  function buildFolderCard(project, index) {
    const num = String(index + 1).padStart(2, '0');
    const card = document.createElement('div');
    card.className = 'folder-card fade-in';

    // Automatisch das erste Bild der Mappe als Cover nutzen.
    // Bevorzugt wird die größere "cover"-Version (schärfer, da das
    // Mappen-Cover groß dargestellt wird); falls nicht vorhanden, fällt
    // es auf "thumb" und zuletzt auf das Original zurück.
    const hasImages = project.images && project.images.length > 0;
    const coverImg = hasImages ? project.images[0] : null;
    const coverPath = coverImg ? (coverImg.cover || coverImg.thumb || coverImg.path) : null;

    const thumbInner = coverPath
      ? `<img src="${coverPath}" alt="${escapeHtml(project.name)}" loading="lazy" decoding="async">`
      : `<div class="folder-thumb-empty">
           <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"><path d="M3 3l18 18M21 15V5a2 2 0 00-2-2H8M3 9v10a2 2 0 002 2h10M9 13a2 2 0 100-4 2 2 0 000 4z"/></svg>
           <span>leere Rolle</span>
         </div>`;

    const count = hasImages ? project.images.length : 0;

    card.innerHTML = `
      <button class="folder-thumb" data-action="open">
        ${thumbInner}
        <span class="tag-num">Nº ${num}</span>
      </button>
      <div class="folder-meta-row">
        <div style="flex:1; min-width:0;">
          <h3 class="folder-name">${escapeHtml(project.name)}</h3>
          <p class="folder-count">${count} ${count === 1 ? 'Bild' : 'Bilder'}</p>
        </div>
      </div>
    `;

    card.querySelector('[data-action="open"]').addEventListener('click', () => openProject(project.id));
    return card;
  }

  // ---------------------------------------------------------------
  // Gallery: Navigation & Grid
  // ---------------------------------------------------------------
  function openProject(id) {
    currentId = id;
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    images = project.images || [];

    viewHome.hidden = true;
    viewGallery.hidden = false;
    viewGallery.classList.add('fade-in');

    galleryTitle.textContent = project.name;
    galleryMeta.textContent = `${images.length} ${images.length === 1 ? 'Bild' : 'Bilder'}`;

    renderImageGrid();
  }

  function goHome() {
    currentId = null;
    images = [];
    viewGallery.hidden = true;
    viewHome.hidden = false;
    viewHome.classList.add('fade-in');
    renderHome();
  }

  function renderImageGrid() {
    imageGrid.innerHTML = '';
    images.forEach((img, i) => {
      imageGrid.appendChild(buildImageTile(img, i));
    });
  }

  function buildImageTile(image, index) {
    const num = String(index + 1).padStart(2, '0');
    const isCover = index === 0;
    const tile = document.createElement('div');
    tile.className = 'image-tile fade-in';
    // Im Grid wird die kleine Vorschauversion (thumb) angezeigt, nicht das
    // Originalbild — das spart Ladezeit und macht das Scrollen flüssig.
    // Das Originalbild (path) wird erst in der Lightbox nachgeladen.
    const previewSrc = image.thumb || image.path;
    tile.innerHTML = `
      <button class="image-thumb" data-action="open">
        <img src="${previewSrc}" alt="${escapeHtml(image.name)}" loading="lazy" decoding="async">
        <span class="tag-num">Nº ${num}</span>
        ${isCover ? `<span class="cover-badge" title="Titelbild">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon></svg>
        </span>` : ''}
      </button>
    `;

    tile.querySelector('[data-action="open"]').addEventListener('click', () => openLightbox(index));
    return tile;
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
    lbImage.classList.add('lb-image-hidden');
    lbCaption.classList.add('lb-caption-hidden');
    lbImage.src = '';
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

    // Lädt direkt das Originalbild — kein Zwischenschritt über das
    // Thumbnail, damit die Bildgröße beim Öffnen nicht "springt".
    // Während des Ladens zeigt ein Spinner an, dass etwas passiert.
    lbImage.classList.add('lb-image-hidden');
    lbCaption.classList.add('lb-caption-hidden');
    lbSpinner.hidden = false;

    const fullImg = new Image();
    fullImg.onload = () => {
      // Nur anzeigen, wenn der Nutzer währenddessen nicht weitergeblättert hat
      if (images[lightboxIndex] !== img) return;
      lbImage.src = img.path;
      lbImage.alt = img.name;
      lbImage.classList.remove('lb-image-hidden');
      lbCaption.classList.remove('lb-caption-hidden');
      lbSpinner.hidden = true;
    };
    fullImg.onerror = () => {
      if (images[lightboxIndex] !== img) return;
      lbSpinner.hidden = true;
      showToast('Bild konnte nicht geladen werden.');
    };
    fullImg.src = img.path;

    const num = String(lightboxIndex + 1).padStart(2, '0');
    const total = String(images.length).padStart(2, '0');
    lbCaption.innerHTML = `<span class="lb-index">Nº ${num}</span> / ${total}<span class="lb-name">${escapeHtml(img.name)}</span>`;
  }

  // ---------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------
  $('btn-back').addEventListener('click', goHome);

  $('lb-close').addEventListener('click', closeLightbox);
  $('lb-prev').addEventListener('click', lightboxPrev);
  $('lb-next').addEventListener('click', lightboxNext);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  });

  $('toast-close').addEventListener('click', () => { toast.hidden = true; });

  // Start der Anwendung
  initApp();
})();
