#!/usr/bin/env python3
"""
Erzeugt kleine, komprimierte Vorschaubilder für alle Bilder im
Bilder-Ordner und hält portfolio.json automatisch auf dem aktuellen
Stand — neue Mappen (Unterordner) und neue Bilder werden automatisch
erkannt und ergänzt, ohne dass du sie von Hand in die JSON eintragen
musst.

Es werden zwei Vorschau-Versionen erzeugt:
  - "thumb": kleine Vorschau (Standard 700px) für das Bilder-Grid innerhalb
    einer Galerie, wo viele kleine Kacheln nebeneinander stehen.
  - "cover": größere, schärfere Version (Standard 1400px) nur für das erste
    Bild jeder Mappe, da dieses als großes Mappen-Cover auf der Startseite
    dient und dort mehr Schärfe braucht.

So funktioniert die automatische Erkennung:
    - Jeder Unterordner in IMAGES_BASE_DIR (Standard: "projekte") wird als
      eigene Mappe behandelt. Der Ordnername wird zur internen ID; der
      angezeigte Mappen-Name wird beim ERSTEN Auffinden automatisch aus dem
      Ordnernamen abgeleitet (z.B. "street-photography" -> "Street
      Photography"). Einmal in portfolio.json gespeicherte Namen werden bei
      späteren Läufen NICHT überschrieben, du kannst sie also gefahrlos von
      Hand anpassen.
    - Innerhalb jeder Mappe wird jede Bilddatei (.jpg, .jpeg, .png, .webp)
      automatisch erkannt. Neue Bilder werden alphabetisch nach Dateiname
      einsortiert.
    - Bereits in portfolio.json vorhandene Mappen/Bilder werden nicht
      verändert oder neu sortiert — nur neu hinzugekommene Mappen/Bilder
      werden ergänzt.
    - Bilder, die aus dem Ordner entfernt wurden, aber noch in
      portfolio.json stehen, werden NICHT automatisch gelöscht (das Skript
      löscht nie von sich aus Einträge — falls du ein Bild endgültig
      entfernen willst, lösche den Eintrag manuell aus portfolio.json).

Verwendung:
    1. Bilder in Unterordner von "projekte/" legen, z.B.
       "projekte/landschaft/foto1.jpg"
    2. Dieses Skript in den Ordner legen, der "projekte/" und
       portfolio.json enthält (dein lokal geklontes GitHub-Repo).
    3. Ausführen:  python3 generate_thumbnails.py
    4. Die Ordner "thumbs/" und "covers/" sowie die aktualisierte
       portfolio.json zu GitHub hochladen/committen.

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
IMAGES_BASE_DIR = "images"      # Ordner, der die Mappen-Unterordner enthält
THUMB_DIR = "thumbs"              # Ordner für die kleinen Grid-Vorschaubilder
COVER_DIR = "covers"              # Ordner für die größeren Mappen-Cover
MAX_DIM = 700                     # maximale Kantenlänge der Grid-Vorschaubilder (px)
COVER_MAX_DIM = 1400              # maximale Kantenlänge der Mappen-Cover (px)
JPEG_QUALITY = 78                 # Kompressionsqualität Grid-Vorschau (0-100)
COVER_JPEG_QUALITY = 85           # Kompressionsqualität Mappen-Cover (0-100)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}  # erkannte Bildformate

# Ordnernamen, die trotz Lage in IMAGES_BASE_DIR NICHT als Mappe behandelt
# werden sollen (z.B. falls sich dort versehentlich Systemordner befinden)
IGNORED_DIR_NAMES = {".git", ".DS_Store", "__pycache__"}


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


def humanize_folder_name(folder_name: str) -> str:
    """Leitet einen lesbaren Anzeigenamen aus einem Ordnernamen ab,
    z.B. 'street-photography' -> 'Street Photography',
         'schwarz_weiss'      -> 'Schwarz Weiss'."""
    words = folder_name.replace("-", " ").replace("_", " ").split()
    return " ".join(word.capitalize() for word in words) if words else folder_name


def humanize_file_name(file_stem: str) -> str:
    """Leitet einen lesbaren Bildnamen aus dem Dateinamen ab (ohne
    Endung), z.B. 'foto_01' -> 'Foto 01'."""
    words = file_stem.replace("-", " ").replace("_", " ").split()
    return " ".join(word.capitalize() for word in words) if words else file_stem


def discover_project_folders(base_dir: Path):
    """Findet alle Unterordner von base_dir, die als Mappe gelten sollen.
    Gibt eine Liste von Path-Objekten zurück, alphabetisch sortiert."""
    if not base_dir.exists():
        return []
    folders = [
        p for p in base_dir.iterdir()
        if p.is_dir() and p.name not in IGNORED_DIR_NAMES and not p.name.startswith(".")
    ]
    return sorted(folders, key=lambda p: p.name.lower())


def discover_images_in_folder(folder: Path):
    """Findet alle Bilddateien in einem Mappen-Ordner, alphabetisch
    sortiert nach Dateiname."""
    files = [
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(files, key=lambda p: p.name.lower())


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


def sync_projects_with_filesystem(projects, base_dir: Path):
    """Gleicht die bestehende projects-Liste mit dem tatsächlichen Inhalt
    von base_dir ab: neue Mappen-Ordner und neue Bilddateien werden
    automatisch ergänzt. Vorhandene Einträge (Namen, Reihenfolge, bereits
    gepflegte Felder) bleiben unverändert. Nichts wird gelöscht.

    Gibt (projects, neue_mappen_anzahl, neue_bilder_anzahl) zurück."""
    projects_by_id = {p["id"]: p for p in projects}
    new_project_count = 0
    new_image_count = 0

    for folder in discover_project_folders(base_dir):
        project_id = folder.name

        if project_id not in projects_by_id:
            print(f"  Neue Mappe gefunden: '{project_id}'")
            new_project = {
                "id": project_id,
                "name": humanize_folder_name(project_id),
                "images": [],
            }
            projects.append(new_project)
            projects_by_id[project_id] = new_project
            new_project_count += 1

        project = projects_by_id[project_id]
        existing_paths = {img.get("path") for img in project.get("images", [])}

        for image_file in discover_images_in_folder(folder):
            rel_path = str(image_file.as_posix())
            if rel_path in existing_paths:
                continue  # bereits bekannt, nicht erneut hinzufügen

            print(f"    Neues Bild gefunden: {rel_path}")
            project.setdefault("images", []).append({
                "name": humanize_file_name(image_file.stem),
                "path": rel_path,
            })
            new_image_count += 1

    return projects, new_project_count, new_image_count


def main():
    json_path = Path(JSON_PATH)
    base_dir = Path(IMAGES_BASE_DIR)

    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            projects = json.load(f)
    else:
        print(f"'{JSON_PATH}' existiert noch nicht — wird neu angelegt.")
        projects = []

    print(f"Durchsuche '{IMAGES_BASE_DIR}/' nach neuen Mappen und Bildern …")
    projects, new_projects, new_images = sync_projects_with_filesystem(projects, base_dir)
    if new_projects == 0 and new_images == 0:
        print("  Keine neuen Mappen oder Bilder gefunden.")
    else:
        print(f"  {new_projects} neue Mappe(n), {new_images} neue(s) Bild(er) ergänzt.")
    print()

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
    print(f"Fertig. {new_projects} neue Mappe(n) und {new_images} neue(s) Bild(er) erkannt. "
          f"{created} Vorschaubilder neu erzeugt, {covers_created} Mappen-Cover neu erzeugt, "
          f"{skipped} bereits vorhanden, {failed} fehlgeschlagen, {total} Bilder insgesamt.")
    print(f"Die Datei '{JSON_PATH}' wurde aktualisiert.")
    print(f"Bitte die Ordner '{THUMB_DIR}/' und '{COVER_DIR}/' sowie '{JSON_PATH}' zu GitHub hochladen.")


if __name__ == "__main__":
    main()
