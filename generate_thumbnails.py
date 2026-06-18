#!/usr/bin/env python3
"""
Erzeugt kleine, komprimierte Vorschaubilder für alle Bilder, die in
portfolio.json referenziert sind, und ergänzt die JSON automatisch um
"thumb"- und "cover"-Felder.

Es werden zwei Versionen erzeugt:
  - "thumb": kleine Vorschau (Standard 700px) für das Bilder-Grid innerhalb
    einer Galerie, wo viele kleine Kacheln nebeneinander stehen.
  - "cover": größere, schärfere Version (Standard 1400px) nur für das erste
    Bild jeder Mappe, da dieses als großes Mappen-Cover auf der Startseite
    dient und dort mehr Schärfe braucht.

Verwendung:
    1. Dieses Skript in den Ordner legen, in dem auch portfolio.json liegt
       (also dein GitHub-Repo-Ordner, lokal geklont).
    2. Einmalig ausführen:  python3 generate_thumbnails.py
    3. Die neu erzeugten Ordner ("thumbs/" und "covers/") und die
       aktualisierte portfolio.json zu GitHub hochladen/committen.

Das Skript verändert deine Originalbilder NICHT. Es legt nur zusätzliche,
kleinere Kopien an.

Voraussetzung: Python-Paket "Pillow" (falls nicht installiert: 
    pip install Pillow
)
"""

import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Das Paket 'Pillow' wird benötigt. Installiere es mit:")
    print("    pip install Pillow")
    sys.exit(1)

# ---------------------------------------------------------------------
# Einstellungen — bei Bedarf anpassen
# ---------------------------------------------------------------------
JSON_PATH = "portfolio.json"      # Pfad zu deiner Portfolio-Datei
THUMB_DIR = "thumbs"              # Ordner für die kleinen Grid-Vorschaubilder
COVER_DIR = "covers"              # Ordner für die größeren Mappen-Cover
MAX_DIM = 700                     # maximale Kantenlänge der Grid-Vorschaubilder (px)
COVER_MAX_DIM = 1400              # maximale Kantenlänge der Mappen-Cover (px)
JPEG_QUALITY = 78                 # Kompressionsqualität Grid-Vorschau (0-100)
COVER_JPEG_QUALITY = 85           # Kompressionsqualität Mappen-Cover (0-100)


def make_thumbnail(source_path: Path, dest_path: Path, max_dim: int, quality: int) -> bool:
    """Erstellt ein verkleinertes, komprimiertes JPEG. Gibt True bei Erfolg zurück."""
    try:
        with Image.open(source_path) as img:
            # EXIF-Rotation korrekt anwenden (sonst landen Hochformat-Fotos
            # nach dem Verkleinern manchmal seitlich verdreht)
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            img.save(dest_path, "JPEG", quality=quality, optimize=True)
        return True
    except Exception as e:
        print(f"  Fehler bei {source_path}: {e}")
        return False


def derived_path_for(original_path: str, base_dir: str) -> str:
    """Erzeugt einen Pfad parallel zur Ordnerstruktur des Originals,
    z. B. 'projekte/landschaft/foto1.jpg' -> 'thumbs/projekte/landschaft/foto1.jpg'
    """
    rel = original_path.lstrip("./")
    path = f"{base_dir}/{rel}"
    return str(Path(path).with_suffix(".jpg"))


def read_aspect_ratio(image_path: Path):
    """Liest Breite/Höhe eines Bildes (z.B. 1.5 für ein Querformat-Bild).
    Berücksichtigt EXIF-Rotation, damit das Verhältnis zur tatsächlichen
    Anzeige passt. Gibt None zurück, falls das Bild nicht gelesen werden
    konnte."""
    try:
        with Image.open(image_path) as img:
            img = ImageOps.exif_transpose(img)
            width, height = img.size
            if height == 0:
                return None
            return round(width / height, 4)
    except Exception as e:
        print(f"  Seitenverhältnis konnte nicht gelesen werden für {image_path}: {e}")
        return None


def main():
    json_path = Path(JSON_PATH)
    if not json_path.exists():
        print(f"Konnte '{JSON_PATH}' nicht finden. Bitte dieses Skript in den")
        print("gleichen Ordner legen, in dem auch deine portfolio.json liegt.")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        projects = json.load(f)

    total = 0
    created = 0
    skipped = 0
    failed = 0
    covers_created = 0

    for project in projects:
        images = project.get("images", [])
        for index, image in enumerate(images):
            total += 1
            original_rel_path = image.get("path")
            if not original_rel_path:
                continue

            original_path = Path(original_rel_path)
            if not original_path.exists():
                print(f"  Übersprungen (Original nicht gefunden): {original_rel_path}")
                failed += 1
                continue

            # --- Kleine Grid-Vorschau (für jedes Bild) ---
            thumb_rel_path = derived_path_for(original_rel_path, THUMB_DIR)
            thumb_path = Path(thumb_rel_path)

            if thumb_path.exists():
                image["thumb"] = thumb_rel_path
                skipped += 1
            else:
                print(f"  Erzeuge Vorschau: {thumb_rel_path}")
                if make_thumbnail(original_path, thumb_path, MAX_DIM, JPEG_QUALITY):
                    image["thumb"] = thumb_rel_path
                    created += 1
                else:
                    failed += 1

            # --- Seitenverhältnis ermitteln (für gleich hohe Kacheln mit
            #     proportionaler Breite im Bilder-Grid, ohne Layoutsprung) ---
            if "ratio" not in image:
                # Aus dem (kleineren, schnelleren) Thumbnail lesen, falls
                # vorhanden, sonst aus dem Original
                source_for_ratio = thumb_path if thumb_path.exists() else original_path
                ratio = read_aspect_ratio(source_for_ratio)
                if ratio:
                    image["ratio"] = ratio

            # --- Größeres, schärferes Cover (nur für das erste Bild
            #     jeder Mappe, da nur dieses als Mappen-Cover dient) ---
            if index == 0:
                cover_rel_path = derived_path_for(original_rel_path, COVER_DIR)
                cover_path = Path(cover_rel_path)

                if cover_path.exists():
                    image["cover"] = cover_rel_path
                else:
                    print(f"  Erzeuge Mappen-Cover: {cover_rel_path}")
                    if make_thumbnail(original_path, cover_path, COVER_MAX_DIM, COVER_JPEG_QUALITY):
                        image["cover"] = cover_rel_path
                        covers_created += 1
                    else:
                        failed += 1

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)

    print()
    print(f"Fertig. {created} Vorschaubilder neu erzeugt, {covers_created} Mappen-Cover neu erzeugt, "
          f"{skipped} bereits vorhanden, {failed} fehlgeschlagen, {total} Bilder insgesamt.")
    print(f"Die Datei '{JSON_PATH}' wurde aktualisiert (Felder 'thumb' und 'cover' ergänzt).")
    print(f"Bitte die Ordner '{THUMB_DIR}/' und '{COVER_DIR}/' sowie '{JSON_PATH}' zu GitHub hochladen.")


if __name__ == "__main__":
    main()
