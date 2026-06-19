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

  const navToggle = $('nav-toggle');
  const navMenu = $('nav-menu');
  const navIconOpen = document.querySelector('.nav-icon-open');
  const navIconClose = document.querySelector('.nav-icon-close');
  const viewInfo = $('view-info');
  const viewContact = $('view-contact');
  const impressumOverlay = $('impressum-overlay');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    if (message) toastText.textContent = message;
    toast.hidden = false;
  }

  // Blendet ein <img> sanft ein, sobald es tatsächlich geladen ist (statt
  // abrupt zu erscheinen, sobald der Browser es ins Layout einsetzt).
  // Bereits aus dem Cache geladene Bilder (complete === true) werden direkt
  // sichtbar, ohne unnötige Wartezeit auf ein onload-Event, das nie kommt.
  function fadeInWhenLoaded(imgEl) {
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      imgEl.classList.add('loaded');
    } else {
      imgEl.addEventListener('load', () => imgEl.classList.add('loaded'), { once: true });
    }
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
    const coverImgEl = card.querySelector('.folder-thumb img');
    if (coverImgEl) fadeInWhenLoaded(coverImgEl);
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
    layoutJustifiedGrid();
  }

  // ---------------------------------------------------------------
  // "Justified Gallery"-Layout: ordnet Bilder zeilenweise so an, dass
  // jede Zeile die volle Breite exakt ausfüllt (Höhe wird pro Zeile leicht
  // angepasst), statt dass Zeilen mal mit 1, mal mit 4 Bildern wirken
  // unaufgeräumt nebeneinander stehen.
  // ---------------------------------------------------------------
  const GRID_GAP = 10;           // muss zum CSS-"gap" von .grid-images passen

  function getTargetRowHeight(containerWidth) {
    // Auf schmalen Bildschirmen niedrigere Zielhöhe, damit dort noch
    // sinnvoll mehrere Bilder pro Zeile passen, statt dass jede Zeile
    // nur ein einzelnes, sehr breites Bild enthält.
    if (containerWidth < 480) return 150;
    if (containerWidth < 768) return 200;
    return 260;
  }

  function layoutJustifiedGrid() {
    const tiles = Array.from(imageGrid.children);
    if (tiles.length === 0) return;

    const containerWidth = imageGrid.clientWidth;
    if (containerWidth === 0) return; // Grid gerade nicht sichtbar (anderer Tab)

    const targetRowHeight = getTargetRowHeight(containerWidth);

    let row = [];
    let rowRatioSum = 0;

    const flushRow = (isLastRow) => {
      if (row.length === 0) return;

      const totalGapWidth = GRID_GAP * (row.length - 1);
      let rowHeight = (containerWidth - totalGapWidth) / rowRatioSum;

      // Die letzte Zeile nicht künstlich aufblasen, falls nur wenige
      // Bilder übrig sind (sonst würden 1-2 Bilder riesig gestreckt).
      if (isLastRow && rowHeight > targetRowHeight * 1.25) {
        rowHeight = targetRowHeight;
      }

      row.forEach(({ tile, ratio }) => {
        tile.style.height = `${rowHeight}px`;
        tile.style.width = `${rowHeight * ratio}px`;
        tile.style.flexGrow = '0';
      });

      row = [];
      rowRatioSum = 0;
    };

    tiles.forEach((tile, i) => {
      const ratio = parseFloat(tile.dataset.ratio) || 1;
      row.push({ tile, ratio });
      rowRatioSum += ratio;

      const projectedWidth = targetRowHeight * rowRatioSum + GRID_GAP * (row.length - 1);
      const isLast = i === tiles.length - 1;

      if (projectedWidth >= containerWidth) {
        flushRow(false);
      } else if (isLast) {
        flushRow(true);
      }
    });
  }

  // Bei Fenstergrößenänderung neu berechnen (z.B. Drehung am Handy,
  // Fenster verkleinern). Per Timeout entprellt, damit nicht bei jedem
  // Pixel während des Ziehens neu gerechnet wird.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layoutJustifiedGrid, 150);
  });

  function buildImageTile(image, index) {
    const num = String(index + 1).padStart(2, '0');
    const isCover = index === 0;
    const tile = document.createElement('div');
    tile.className = 'image-tile fade-in';
    // Im Grid wird die kleine Vorschauversion (thumb) angezeigt, nicht das
    // Originalbild — das spart Ladezeit und macht das Scrollen flüssig.
    // Das Originalbild (path) wird erst in der Lightbox nachgeladen.
    const previewSrc = image.thumb || image.path;
    // Das Seitenverhältnis (aus portfolio.json, von generate_thumbnails.py
    // ermittelt) wird hier nur gespeichert — die tatsächliche Größe der
    // Kachel berechnet layoutJustifiedGrid(), damit jede Zeile randscharf
    // die volle Breite ausfüllt statt unregelmäßig zu wirken.
    const ratio = image.ratio || 1;
    tile.dataset.ratio = String(ratio);
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
    fadeInWhenLoaded(tile.querySelector('.image-thumb img'));
    return tile;
  }

  // ---------------------------------------------------------------
  // Tab-Navigation (Galerie / Info / Kontakt)
  // ---------------------------------------------------------------
  function showTab(tab) {
    // Alle Top-Level-Views verstecken, dann die passende(n) wieder zeigen
    viewInfo.hidden = tab !== 'info';
    viewContact.hidden = tab !== 'contact';

    if (tab === 'gallery') {
      // Innerhalb des Galerie-Tabs entscheidet currentId, ob der
      // Mappen-Index oder eine geöffnete Mappe gezeigt wird.
      if (currentId) {
        viewHome.hidden = true;
        viewGallery.hidden = false;
        // Während eines anderen Tabs hatte das Grid clientWidth = 0,
        // daher hier neu berechnen, sobald es wieder sichtbar ist.
        layoutJustifiedGrid();
      } else {
        viewHome.hidden = false;
        viewGallery.hidden = true;
      }
    } else {
      viewHome.hidden = true;
      viewGallery.hidden = true;
    }

    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    closeNavMenu();
  }

  function openNavMenu() {
    navMenu.hidden = false;
    navToggle.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
    navIconOpen.hidden = true;
    navIconClose.hidden = false;
  }

  function closeNavMenu() {
    navMenu.hidden = true;
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navIconOpen.hidden = false;
    navIconClose.hidden = true;
  }

  function toggleNavMenu() {
    if (navMenu.hidden) openNavMenu();
    else closeNavMenu();
  }

  function openImpressum() {
    impressumOverlay.hidden = false;
  }

  function closeImpressum() {
    impressumOverlay.hidden = true;
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
    // Der Spinner blendet sich erst nach kurzer Verzögerung sanft ein
    // (siehe CSS) und das Bild blendet beim Erscheinen sanft auf.
    lbImage.classList.add('lb-image-hidden');
    lbCaption.classList.add('lb-caption-hidden');
    lbSpinner.hidden = false;
    lbSpinner.classList.add('lb-spinner-visible');

    const fullImg = new Image();
    fullImg.onload = () => {
      // Nur anzeigen, wenn der Nutzer währenddessen nicht weitergeblättert hat
      if (images[lightboxIndex] !== img) return;
      lbSpinner.classList.remove('lb-spinner-visible');
      lbSpinner.hidden = true;
      lbImage.src = img.path;
      lbImage.alt = img.name;
      lbCaption.classList.remove('lb-caption-hidden');
      // Eine Frame warten, damit der Browser die neue src kennt, bevor
      // die Opacity-Transition für das sanfte Einblenden startet.
      requestAnimationFrame(() => {
        lbImage.classList.remove('lb-image-hidden');
      });
    };
    fullImg.onerror = () => {
      if (images[lightboxIndex] !== img) return;
      lbSpinner.classList.remove('lb-spinner-visible');
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
    if (e.key !== 'Escape') {
      if (!lightbox.hidden) {
        if (e.key === 'ArrowLeft') lightboxPrev();
        if (e.key === 'ArrowRight') lightboxNext();
      }
      return;
    }
    // Escape schließt zuerst die Lightbox, falls offen, sonst das Nav-Menü
    if (!lightbox.hidden) closeLightbox();
    else if (!navMenu.hidden) closeNavMenu();
    else if (!impressumOverlay.hidden) closeImpressum();
  });

  $('toast-close').addEventListener('click', () => { toast.hidden = true; });

  navToggle.addEventListener('click', toggleNavMenu);
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.addEventListener('click', () => showTab(el.dataset.tab));
  });
  document.addEventListener('click', (e) => {
    if (!navMenu.hidden && !e.target.closest('.site-nav')) closeNavMenu();
  });

  $('btn-impressum').addEventListener('click', openImpressum);
  $('impressum-close').addEventListener('click', closeImpressum);
  impressumOverlay.addEventListener('click', (e) => {
    if (e.target === impressumOverlay) closeImpressum();
  });

  // Start der Anwendung
  showTab('gallery');
  initApp();
})();
