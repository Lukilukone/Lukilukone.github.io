# Änderungen

## Update: Lightbox ohne Größensprung + schärferes Mappen-Cover

**Lightbox:** Beim Öffnen eines Bildes wird jetzt direkt das Originalbild
geladen (kein Thumbnail-Zwischenschritt mehr). Während des Ladens erscheint
ein kleiner Spinner statt eines Bildes — dadurch gibt es keinen
"Größensprung" mehr von klein zu groß, da nie ein kleines Bild im
Vollbild-Container angezeigt wird.

**Mappen-Cover:** Das Skript erzeugt jetzt zwei Vorschau-Stufen:
- `thumb` (700px) — für die kleinen Kacheln im Bilder-Grid einer Galerie
- `cover` (1400px, höhere Qualität) — nur für das jeweils erste Bild jeder
  Mappe, da dieses groß als Mappen-Cover auf der Startseite erscheint und
  dort mehr Schärfe braucht

Falls du bereits `generate_thumbnails.py` einmal ausgeführt hattest: Lösche
einfach den Ordner `thumbs/` und führe das Skript erneut aus — dann werden
sowohl die `thumb`- als auch die neuen `cover`-Dateien frisch erzeugt.
Falls du nur die neuen `cover`-Bilder ergänzen willst, ohne `thumbs/`
neu zu erzeugen: einfach das Skript erneut ausführen, es überspringt
automatisch, was schon existiert, und erzeugt nur die fehlenden
`covers/`-Dateien.

---

## 1. Favicon ("L"-Logo im Browser-Tab)

`favicon.svg` wurde hinzugefügt und in `index.html` per `<link rel="icon">`
eingebunden. Einfach mit hochladen — keine weiteren Schritte nötig.

Falls du das Logo anders gestalten willst (andere Farbe, andere Form), ist
`favicon.svg` eine normale SVG-Datei und kann direkt im Texteditor angepasst
werden.

## 2. Performance: Vorschaubilder (Thumbnails)

**Das Problem:** Im Grid und als Mappen-Cover wurden bisher die vollen
Originalbilder geladen und vom Browser auf Kachelgröße herunterskaliert.
Bei vielen/großen Fotos verursacht das langsames Laden und Ruckeln beim
Scrollen.

**Die Lösung:** `app.js` nutzt jetzt automatisch ein kleines Vorschaubild
(`thumb`-Feld in `portfolio.json`), falls vorhanden — sowohl im Mappen-Grid
als auch im Bilder-Grid einer Galerie. Das Originalbild (`path`) wird nur
noch geladen, wenn ein Bild in der Lightbox (Vollbildansicht) geöffnet wird.
Zusätzlich wurde `loading="lazy"` ergänzt, damit Bilder außerhalb des
Sichtbereichs gar nicht erst geladen werden.

**So erzeugst du die Vorschaubilder:**

1. Stelle sicher, dass Python 3 und das Paket "Pillow" installiert sind:
   ```
   pip install Pillow
   ```
2. Kopiere `generate_thumbnails.py` in den Ordner deines lokal geklonten
   GitHub-Repos — also dorthin, wo auch `portfolio.json` liegt.
3. Führe es einmalig aus:
   ```
   python3 generate_thumbnails.py
   ```
4. Das Skript legt einen neuen Ordner `thumbs/` an (mit kleinen,
   komprimierten Kopien aller Bilder) und ergänzt `portfolio.json`
   automatisch um ein `"thumb"`-Feld pro Bild.
5. Lade `thumbs/` und die aktualisierte `portfolio.json` zu GitHub hoch
   (zusätzlich zu deinen bisherigen Dateien — die Originalbilder bleiben
   unverändert).

**Wenn du später neue Bilder hinzufügst:** Einfach das Skript erneut
ausführen. Es überspringt automatisch bereits vorhandene Thumbnails und
erzeugt nur für neue Bilder welche.

**Einstellungen anpassen:** Am Anfang von `generate_thumbnails.py` kannst du
`MAX_DIM` (maximale Kantenlänge der Vorschaubilder, Standard 700px) und
`JPEG_QUALITY` (Kompressionsstärke, Standard 78) ändern, falls du schärfere
oder noch kleinere Vorschaubilder möchtest.

**Falls `portfolio.json` (noch) kein `thumb`-Feld für ein Bild hat:** Kein
Problem — `app.js` fällt in diesem Fall automatisch auf das Originalbild
zurück. Die Seite funktioniert also auch ohne das Skript weiter, nur eben
ohne den Geschwindigkeitsvorteil.

## 3. Zusätzliche CSS-Optimierung

`content-visibility: auto` wurde für Bild-Kacheln ergänzt. Das weist den
Browser an, Inhalte außerhalb des Sichtbereichs gar nicht erst zu rendern,
was bei langen Galerien zusätzlich Rechenzeit beim Scrollen spart.
