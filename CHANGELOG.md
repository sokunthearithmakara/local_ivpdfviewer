# Changelog

All notable changes to this project will be documented in this file.

## [1.5] - 2026-11-10

- Audio accompaniment: upload audio files (subfolders become lessons) and play them in a Contents sidebar and player bar inside the PDF viewer.
- Audio-to-page map stored as JSON in `text1`, keyed by lesson folder and file path, with per-track time cues. Replaces the free-text mapping field.
- New web service `local_ivpdfviewer_save_audio_map` for saving the map from the viewer.
- Site setting to load a Google Font in the viewer.
- Requires Interactive Video 2.3.2 (2026111000).

## [1.4+] - 2026-06-08

- Complete Khmer (km) language pack.
- Require Interactive Video 1.8.1+ (2026060800).

## [1.4] - 2026-05-26

- Added external PDF URL support as an alternative to uploading a local file.
- Added form validation for file and URL source types.
- Improved scroll-to-last-page completion detection and page progress tracking in Flexbook.
- Added `db/upgrade.php` to register the content type in Flexbook on upgrade.
- Updated CI workflow to match mod_flexbook (Moodle 4.05–5.02 matrix).
- Moodle 5.2 support.

## [1.3] - 2026-05-14

- Added Flexbook support with drag-and-drop for `.pdf` files.
- Refactored JavaScript into a shared `utils` module and added a PHP helper class.
- Refactored form elements into the helper class for Interactive Video and Flexbook.

## [1.0] - 2024-11-05

### First release