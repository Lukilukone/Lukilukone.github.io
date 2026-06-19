# Änderungen

## Update 4: Lightbox-Sprung behoben, Grid komplett überarbeitet (Justified Gallery)

**1. Bild-Sprung beim Wechseln in der Lightbox behoben**

Die Ursache war wie vermutet die Bildunterschrift: Sie wurde beim
Bildwechsel kurz komplett ausgeblendet (`display: none`), wodurch sich
die Höhe des Lightbox-Inhalts änderte und das Bild nach unten rutschte.
Die Caption hat jetzt eine feste Mindesthöhe und wird nur noch per
Transparenz ein-/ausgeblendet, nie über `display`. Das Bild bleibt beim
Wechseln zwischen Bildern jetzt an exakt derselben Position.

**2. Bilder-Grid: "Justified Gallery"-Layout statt unregelmäßigem Flex-Wrap**

Vorher wurden Bilder einfach so lange in eine Zeile gepackt, bis keines
mehr passte — das führte dazu, dass manche Zeilen nur 1 (sehr breites)
Bild enthielten, andere 3-4, was unaufgeräumt wirkte.

Jetzt berechnet ein kleines Layout-Skript (in `app.js`) für jede Zeile
die exakt passende Höhe, sodass jede Zeile randscharf die volle Breite
ausfüllt — genau wie bei den bekannten "Justified Gallery"-Layouts (z.B.
Google Photos, Flickr). Die Zielhöhe passt sich responsive an die
Bildschirmbreite an (niedriger auf dem Handy, höher auf Desktop), und
die letzte, unvollständige Zeile wird nicht künstlich aufgebläht.

Das Layout berechnet sich automatisch neu bei Fenstergrößenänderung
sowie beim Zurückwechseln zum Galerie-Tab. Es greift auf das bereits
vorhandene `"ratio"`-Feld in `portfolio.json` zurück — falls du das
Skript schon einmal mit der ratio-Berechnung laufen lassen hast, ist
hier kein erneuter Lauf nötig.

---

## Update 3: Smoothere Animationen, einheitliche Kachelhöhen, Tab-Menü, Impressum

**1. Smoothere Ladeanimation**
- Bilder im Grid (Mappen-Cover und Bilder innerhalb einer Galerie) blenden
  jetzt sanft ein, sobald sie tatsächlich geladen sind, statt abrupt zu
  erscheinen.
- Der Lade-Spinner in der Lightbox erscheint erst nach einer kurzen
  Verzögerung (verhindert ein nerviges Aufblitzen bei schnell ladenden
  Bildern) und blendet sanft ein/aus. Das Bild selbst blendet beim
  Erscheinen sanft auf, statt abrupt zu wechseln.

**2. Einheitliche Kachelhöhe in der Galerie**
- Die Bilder-Kacheln innerhalb einer Mappe haben jetzt alle die gleiche
  Höhe; die Breite richtet sich automatisch nach dem tatsächlichen
  Seitenverhältnis jedes Bildes (klassisches "Justified Gallery"-Layout,
  wie bei vielen Fotograf:innen-Portfolios).
- Dafür ermittelt `generate_thumbnails.py` jetzt automatisch das
  Seitenverhältnis jedes Bildes und trägt es als `"ratio"`-Feld in
  `portfolio.json` ein. **Du musst das Skript daher einmal erneut
  ausführen**, damit dieses Feld für deine bestehenden Bilder ergänzt
  wird (vorhandene `thumb`/`cover`-Dateien werden dabei nicht neu
  erzeugt, nur das fehlende `ratio`-Feld wird nachgetragen).
- Das Mappen-Grid auf der Startseite bleibt bewusst quadratisch — das
  wirkt dort wie ein Karteikarten-Index und war nicht Teil der Anfrage.

**3. Ausklappbares Menü oben rechts**
- Ein Hamburger-Menü-Symbol oben rechts öffnet ein Dropdown mit drei
  Tabs: **Galerie** (Startbildschirm mit deinen Mappen), **Info** und
  **Kontakt**.
- Die Inhalte für Info und Kontakt sind als Platzhalter angelegt — siehe
  Abschnitt "Eigene Inhalte eintragen" unten.

**4. Impressum**
- Am unteren Seitenrand erscheint ein dezenter "Impressum"-Link, der ein
  kleines Overlay mit deinen Pflichtangaben öffnet.

### Eigene Inhalte eintragen

In `index.html` sind drei Stellen mit `<!-- TODO: ... -->`-Kommentaren
markiert, an denen du eigene Inhalte eintragen solltest:

1. **Info-Tab** — Beschreibung deiner fotografischen Ausrichtung/deines
   Stils (sucht nach `view-info`)
2. **Kontakt-Tab** — deine E-Mail-Adresse und Social-Media-Links (sucht
   nach `view-contact`)
3. **Impressum** — deine Pflichtangaben gemäß § 5 TMG (sucht nach
   `impressum-overlay`)

Einfach den Platzhaltertext zwischen den `<p>`-Tags durch deinen eigenen
Text ersetzen.

---

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
