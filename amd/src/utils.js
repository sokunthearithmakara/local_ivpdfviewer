// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * PDF viewer utility module
 *
 * @module     local_ivpdfviewer/utils
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import $ from 'jquery';
import {init as initMapEditor} from 'local_ivpdfviewer/audiomapeditor';

/**
 * Formats seconds as M:SS.
 *
 * @param {number} seconds
 * @returns {string}
 */
const formatTime = (seconds) => {
    if (!isFinite(seconds) || seconds < 0) {
        return '0:00';
    }
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Escapes HTML special characters.
 *
 * @param {string} str
 * @returns {string}
 */
const escapeHtml = (str) => {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Headphones icon used as a PDF.js-style toolbar button mask.
 * @type {string}
 */
const HEADPHONES_MASK = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3E'
    + '%3Cpath d=\'M8 3a5 5 0 0 0-5 5v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a6 6 0 1 1 12 0v5'
    + 'a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1V8a5 5 0 0 0-5-5\'/%3E%3C/svg%3E")';

/**
 * Returns the scoped CSS injected into the PDF.js iframe when audio tracks are configured.
 *
 * @returns {string}
 */
const getAudioStyles = () => `
#outerContainer.ivpdf-has-audio {
    --ivpdf-accent: var(--progressBar-color, rgba(10, 132, 255, 1));
    --ivpdf-muted: color-mix(in srgb, var(--main-color) 72%, transparent);
    --ivpdf-subtle: color-mix(in srgb, var(--main-color) 12%, transparent);
    --ivpdf-active-bg: color-mix(in srgb, var(--ivpdf-accent) 26%, transparent);
    --ivpdf-bar-height: 48px;
}
/* The player stays out of the way until the learner first plays something. */
#outerContainer.ivpdf-has-audio:not(.ivpdf-bar-on) {
    --ivpdf-bar-height: 0px;
}
#outerContainer.ivpdf-has-audio:not(.ivpdf-bar-on) #ivpdf-audio-bar {
    display: none;
}
#outerContainer.ivpdf-has-audio #viewerContainer:not(.pdfPresentationMode) {
    bottom: var(--ivpdf-bar-height) !important;
    transition: inset-inline-start 0.22s ease;
}
#outerContainer.ivpdf-has-audio #sidebarContainer {
    bottom: var(--ivpdf-bar-height) !important;
}
#outerContainer.ivpdf-has-audio.ivpdf-audio-open #viewerContainer:not(.pdfPresentationMode) {
    inset-inline-start: 265px !important;
}
#outerContainer.ivpdf-has-audio.ivpdf-audio-open.sidebarOpen #sidebarContainer {
    inset-inline-start: 265px !important;
}
#outerContainer.ivpdf-has-audio.ivpdf-audio-open.sidebarOpen #viewerContainer:not(.pdfPresentationMode) {
    inset-inline-start: calc(265px + var(--sidebar-width, 200px)) !important;
}
#ivpdf-toggle-contents::before {
    -webkit-mask-image: ${HEADPHONES_MASK};
            mask-image: ${HEADPHONES_MASK};
}
#ivpdf-audio-sidebar {
    position: absolute;
    top: 32px;
    bottom: var(--ivpdf-bar-height);
    inset-inline-start: 0;
    width: 265px;
    background-color: var(--body-bg-color);
    background-image: linear-gradient(var(--sidebar-narrow-bg-color), var(--sidebar-narrow-bg-color));
    border-top: 1px solid rgba(51, 51, 51, 1);
    box-shadow: inset calc(-1px * var(--dir-factor, 1)) 0 0 rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    z-index: 150;
    font: message-box;
    color: var(--main-color);
    transform: translateX(-100%);
    visibility: hidden;
    transition: transform 0.22s ease, visibility 0.22s ease;
    user-select: none;
}
html[dir="rtl"] #ivpdf-audio-sidebar {
    transform: translateX(100%);
}
#outerContainer.ivpdf-audio-open #ivpdf-audio-sidebar {
    transform: translateX(0);
    visibility: visible;
}
.ivpdf-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    box-sizing: border-box;
    padding: 0 12px;
    background-color: var(--sidebar-toolbar-bg-color);
    box-shadow: var(--toolbarSidebar-box-shadow, none);
    border-bottom: var(--toolbarSidebar-border-bottom, none);
    flex-shrink: 0;
}
.ivpdf-sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--main-color);
}
.ivpdf-sidebar-count {
    font-size: 11px;
    color: var(--ivpdf-muted);
}
.ivpdf-lessons-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 4px 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-color) transparent;
}
.ivpdf-lesson-card {
    margin-bottom: 2px;
}
.ivpdf-lesson-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: var(--treeitem-color);
    font: inherit;
    text-align: start;
    cursor: default;
}
.ivpdf-lesson-header:hover {
    background-color: var(--treeitem-bg-color);
    color: var(--treeitem-hover-color);
}
.ivpdf-lesson-row,
.ivpdf-track-row {
    display: flex;
    align-items: center;
    gap: 2px;
}
.ivpdf-lesson-row > .ivpdf-lesson-header,
.ivpdf-track-row > .ivpdf-track-item {
    flex: 1;
    width: auto;
    min-width: 0;
}
.ivpdf-chip-slot {
    display: contents;
}
.ivpdf-lesson-card.is-active .ivpdf-lesson-header {
    color: var(--main-color);
}
.ivpdf-lesson-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--ivpdf-subtle);
    color: var(--main-color);
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.ivpdf-lesson-card.is-active .ivpdf-lesson-num {
    background-color: var(--ivpdf-accent);
    color: #ffffff;
}
.ivpdf-lesson-meta {
    flex: 1;
    min-width: 0;
}
.ivpdf-lesson-title {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 1px;
}
.ivpdf-lesson-sub {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--ivpdf-muted);
}
.ivpdf-lesson-sub svg {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
}
.ivpdf-lesson-chevron {
    width: 12px;
    height: 12px;
    color: var(--ivpdf-muted);
    flex-shrink: 0;
    transition: transform 0.2s ease;
}
.ivpdf-lesson-card.is-expanded .ivpdf-lesson-chevron {
    transform: rotate(180deg);
}
.ivpdf-lesson-tracks {
    display: none;
    padding: 2px 0 4px 18px;
}
.ivpdf-lesson-card.is-expanded .ivpdf-lesson-tracks {
    display: block;
}
.ivpdf-track-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    margin-top: 1px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: var(--treeitem-color);
    font: inherit;
    font-size: 12px;
    text-align: start;
    cursor: default;
}
.ivpdf-track-item:hover {
    background-color: var(--treeitem-bg-color);
    color: var(--treeitem-hover-color);
}
.ivpdf-track-item.is-active {
    background-color: var(--ivpdf-active-bg);
    box-shadow: inset calc(3px * var(--dir-factor, 1)) 0 0 var(--ivpdf-accent);
    color: var(--main-color);
    font-weight: 600;
}
.ivpdf-track-item.is-onpage:not(.is-active),
.ivpdf-lesson-card.is-onpage > .ivpdf-lesson-row .ivpdf-lesson-header {
    box-shadow: inset calc(3px * var(--dir-factor, 1)) 0 0 var(--ivpdf-muted);
    background-color: var(--ivpdf-subtle);
}
.ivpdf-track-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--ivpdf-muted);
    background: transparent;
    color: var(--main-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.ivpdf-track-item.is-active .ivpdf-track-icon {
    background-color: var(--ivpdf-accent);
    border-color: var(--ivpdf-accent);
    color: #ffffff;
}
.ivpdf-track-icon svg {
    width: 9px;
    height: 9px;
}
.ivpdf-page-chip {
    flex-shrink: 0;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 9px;
    background-color: var(--ivpdf-subtle);
    color: var(--main-color);
    font-size: 11px;
    font-weight: 400;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.ivpdf-page-chip.is-empty {
    background-color: transparent;
    border-style: dashed;
    border-color: var(--ivpdf-muted);
    color: var(--ivpdf-muted);
}
.ivpdf-page-chip.is-invalid {
    background-color: color-mix(in srgb, #e5484d 22%, transparent);
    border-color: #e5484d;
}
.ivpdf-track-item.is-active .ivpdf-page-chip:not(.is-empty):not(.is-invalid) {
    background-color: var(--ivpdf-accent);
    color: #ffffff;
}
.ivpdf-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
.ivpdf-track-name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
#ivpdf-audio-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--ivpdf-bar-height);
    box-sizing: border-box;
    background-color: var(--toolbar-bg-color);
    box-shadow: 0 -1px 0 var(--toolbar-border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    gap: 16px;
    z-index: 250;
    font: message-box;
    color: var(--main-color);
    user-select: none;
}
.ivpdf-player-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 0;
    min-width: 0;
    max-width: 250px;
}
.ivpdf-player-badge {
    width: 28px;
    height: 28px;
    border-radius: 2px;
    background-color: var(--ivpdf-subtle);
    color: var(--main-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.ivpdf-player-badge svg {
    width: 16px;
    height: 16px;
    opacity: var(--toolbar-icon-opacity, 0.7);
}
.ivpdf-player-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ivpdf-player-center {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex: 2 1 0;
    max-width: 650px;
    min-width: 0;
    margin: 0 auto;
}
.ivpdf-player-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}
.ivpdf-ctrl-btn {
    border: 0;
    background: none;
    color: var(--main-color);
    width: 28px;
    height: 28px;
    border-radius: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    position: relative;
    outline: none;
}
.ivpdf-ctrl-btn svg {
    width: 16px;
    height: 16px;
    opacity: var(--toolbar-icon-opacity, 0.7);
}
.ivpdf-ctrl-btn:hover,
.ivpdf-ctrl-btn:focus-visible {
    background-color: var(--button-hover-color);
}
.ivpdf-ctrl-btn:hover svg {
    opacity: 1;
}
.ivpdf-ctrl-btn.is-active {
    background-color: var(--toggled-btn-bg-color);
    color: var(--toggled-btn-color);
}
.ivpdf-ctrl-btn.is-active svg {
    opacity: 1;
}
.ivpdf-btn-goto[hidden] {
    display: none;
}
.ivpdf-btn-speed {
    width: auto;
    min-width: 32px;
    padding: 0 4px;
}
.ivpdf-btn-play {
    width: 32px;
    height: 32px;
    margin: 0 4px;
    border-radius: 50%;
    background-color: var(--ivpdf-accent);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.ivpdf-btn-play svg {
    width: 15px;
    height: 15px;
    opacity: 1;
}
.ivpdf-btn-play:hover,
.ivpdf-btn-play:focus-visible {
    background-color: var(--ivpdf-accent);
    filter: brightness(1.12);
}
.ivpdf-repeat-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 8px;
    font-weight: 800;
    color: var(--ivpdf-accent);
}
.ivpdf-player-timeline {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 140px;
}
.ivpdf-time {
    font-size: 11px;
    color: var(--ivpdf-muted);
    font-variant-numeric: tabular-nums;
    min-width: 32px;
}
.ivpdf-time.ivpdf-time-current {
    text-align: end;
}
.ivpdf-seek-slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 16px;
    background: transparent;
    outline: none;
    cursor: pointer;
    margin: 0;
    padding: 0;
}
.ivpdf-seek-slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right,
        var(--ivpdf-accent) 0%, var(--ivpdf-accent) var(--seek-pct, 0%),
        var(--progressBar-bg-color) var(--seek-pct, 0%), var(--progressBar-bg-color) 100%);
}
.ivpdf-seek-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border-radius: 50%;
    background: var(--ivpdf-accent);
    border: 2px solid var(--toolbar-bg-color);
    box-sizing: border-box;
    cursor: pointer;
}
.ivpdf-seek-slider::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right,
        var(--ivpdf-accent) 0%, var(--ivpdf-accent) var(--seek-pct, 0%),
        var(--progressBar-bg-color) var(--seek-pct, 0%), var(--progressBar-bg-color) 100%);
}
.ivpdf-seek-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ivpdf-accent);
    border: 2px solid var(--toolbar-bg-color);
    box-sizing: border-box;
    cursor: pointer;
}
.ivpdf-seek-slider:focus-visible {
    outline: 2px solid var(--focus-ring-color, var(--ivpdf-accent));
    outline-offset: 2px;
}
.ivpdf-player-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    flex: 1 1 0;
    min-width: 0;
    max-width: 250px;
}
@media (max-width: 840px) {
    #outerContainer.ivpdf-has-audio.ivpdf-audio-open #viewerContainer:not(.pdfPresentationMode) {
        inset-inline-start: 0 !important;
    }
    #ivpdf-audio-sidebar {
        background-image: none;
        background-color: var(--sidebar-narrow-bg-color);
        box-shadow: 4px 0 12px rgba(0, 0, 0, 0.35);
    }
    .ivpdf-player-info {
        max-width: 180px;
    }
    .ivpdf-player-right {
        max-width: 120px;
    }
}
@media (max-width: 680px) {
    .ivpdf-player-info {
        display: none;
    }
    .ivpdf-player-right {
        display: none;
    }
    .ivpdf-player-center {
        max-width: 100%;
    }
}
`;

/**
 * SVG icons used in the audio sidebar and player bar.
 */
const ICONS = {
    headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` +
        ` stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/>` +
        `<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3` +
        `a2 2 0 0 0-2-2H3z"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/>` +
        `<rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    goto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` +
        ` stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>` +
        `<polyline points="14 3 14 9 20 9"/><polyline points="10 13 13 16 10 19"/></svg>`,
    repeat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` +
        ` stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/>` +
        `<path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/>` +
        `<path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    chevronDown: `<svg class="ivpdf-lesson-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
        ` stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` +
        ` stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/>` +
        `<line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>` +
        `<line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>` +
        `<line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
};

/**
 * Injects the configured Google Font into the PDF.js iframe if set in site settings.
 *
 * @param {HTMLIFrameElement} iframe - The viewer iframe element.
 * @returns {void}
 */
const injectGoogleFont = (iframe) => {
    const rawFont = iframe.getAttribute('data-font');
    if (!rawFont) {
        return;
    }

    let fontConfig;
    try {
        fontConfig = JSON.parse(rawFont);
    } catch (e) {
        return;
    }

    const family = String(fontConfig?.family || '').trim();
    const url = String(fontConfig?.url || '').trim();
    if (!family || !url) {
        return;
    }

    const doc = iframe.contentWindow?.document;
    if (!doc || !doc.head) {
        return;
    }

    if (url.includes('fonts.googleapis.com')) {
        ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].forEach((origin) => {
            if (!doc.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
                const preconnect = doc.createElement('link');
                preconnect.rel = 'preconnect';
                preconnect.href = origin;
                preconnect.crossOrigin = 'anonymous';
                doc.head.appendChild(preconnect);
            }
        });
    }

    if (!doc.getElementById('ivpdf-google-font')) {
        const fontLink = doc.createElement('link');
        fontLink.id = 'ivpdf-google-font';
        fontLink.rel = 'stylesheet';
        fontLink.href = url;
        doc.head.appendChild(fontLink);
    }

    if (!doc.getElementById('ivpdf-google-font-styles')) {
        const styleEl = doc.createElement('style');
        styleEl.id = 'ivpdf-google-font-styles';
        styleEl.textContent = `
            html, body, #outerContainer {
                --ivpdf-font: ${family};
            }
            #outerContainer :is(
                #toolbarContainer,
                #toolbarContainer *,
                #sidebarContainer,
                #sidebarContainer *,
                #secondaryToolbar,
                #secondaryToolbar *,
                #findbar,
                #findbar *,
                .doorHanger,
                .doorHanger *,
                #ivpdf-audio-sidebar,
                #ivpdf-audio-sidebar *,
                #ivpdf-audio-bar,
                #ivpdf-audio-bar *
            ) {
                font-family: var(--ivpdf-font) !important;
            }
        `;
        doc.head.appendChild(styleEl);
    }
};

/**
 * Initializes the audio sidebar, top toolbar toggle button, and bottom player bar inside the PDF.js iframe.
 *
 * @param {HTMLIFrameElement} iframe - The viewer iframe element.
 * @param {Object} pdf - The PDFViewerApplication.pdfViewer instance.
 * @param {Array<number>} visiblePages - Allowed 1-based page numbers.
 * @param {string} ns - Event namespace for cleanup.
 * @param {number|string} annotationId - The interaction ID.
 * @param {boolean} isEditMode - Whether the viewer is shown on the interactions editor page.
 * @returns {void}
 */
const initAudioPlayer = (iframe, pdf, visiblePages, ns, annotationId, isEditMode) => {
    const rawAudio = iframe.getAttribute('data-audio');
    if (!rawAudio) {
        return;
    }

    let payload;
    try {
        payload = JSON.parse(rawAudio);
    } catch (e) {
        return;
    }

    const groups = Array.isArray(payload?.groups) ? payload.groups : [];
    if (groups.length === 0) {
        return;
    }

    const strings = payload.strings || {};
    const str = {
        contents: strings.contents || 'Contents',
        hidecontents: strings.hidecontents || 'Hide contents',
        showcontents: strings.showcontents || 'Show contents',
        paused: strings.paused || 'PAUSED',
        playing: strings.playing || 'PLAYING',
        playpause: strings.playpause || 'Play / Pause',
        gotopage: strings.gotopage || 'Go to page {page}',
        playbackspeed: strings.playbackspeed || 'Playback speed',
        repeat: strings.repeat || 'Repeat',
        lesson: strings.lesson || '1 lesson',
        lessons: strings.lessons || '{count} lessons',
        track: strings.track || '1 track',
        tracks: strings.tracks || '{count} tracks',
        trackxofy: strings.trackxofy || 'Track {current} of {total}',
        pageshort: strings.pageshort || 'p. {page}',
        notlinked: strings.notlinked || 'Not linked to a page',
        pagenotshown: strings.pagenotshown || 'Page {page} is not one of the pages shown',
    };
    // On the editor page, editors see every link, including missing and broken ones, and can change them.
    // Everywhere else, including the view page, everyone sees what learners see.
    const canEdit = isEditMode && payload.canedit === true;

    const doc = iframe.contentWindow.document;
    const outerContainer = doc.getElementById('outerContainer');
    if (!outerContainer || doc.getElementById('ivpdf-audio-bar')) {
        return;
    }

    // Flatten tracks for sequential playback and indexing.
    const allTracks = [];
    groups.forEach((group, gIdx) => {
        const gTracks = Array.isArray(group.tracks) ? group.tracks : [];
        gTracks.forEach((track, tIdx) => {
            allTracks.push({
                globalIndex: allTracks.length,
                groupIndex: gIdx,
                trackIndexInGroup: tIdx,
                groupTotalTracks: gTracks.length,
                groupTitle: group.title || `Lesson ${gIdx + 1}`,
                ungrouped: Boolean(group.ungrouped),
                title: track.title || `Track ${tIdx + 1}`,
                url: track.url,
                source: track,
            });
        });
    });

    if (allTracks.length === 0) {
        return;
    }

    // Inject scoped styles into iframe head.
    if (!doc.getElementById('ivpdf-audio-styles')) {
        const styleEl = doc.createElement('style');
        styleEl.id = 'ivpdf-audio-styles';
        styleEl.textContent = getAudioStyles();
        doc.head.appendChild(styleEl);
    }

    // The contents panel starts open only when it fits beside the page rather than over it (see the 840px rule).
    const startOpen = (iframe.contentWindow.innerWidth || 0) > 840;
    const startLabel = startOpen ? str.hidecontents : str.showcontents;
    outerContainer.classList.add('ivpdf-has-audio');
    outerContainer.classList.toggle('ivpdf-audio-open', startOpen);

    // Add the contents toggle button to the PDF.js top-left toolbar, right after the native sidebar toggle.
    const toolbarLeft = doc.getElementById('toolbarViewerLeft');
    const sidebarToggle = doc.getElementById('sidebarToggle');
    const toggleBtn = doc.createElement('button');
    toggleBtn.id = 'ivpdf-toggle-contents';
    toggleBtn.type = 'button';
    toggleBtn.className = startOpen ? 'toolbarButton toggled' : 'toolbarButton';
    toggleBtn.title = startLabel;
    toggleBtn.setAttribute('aria-pressed', startOpen ? 'true' : 'false');
    toggleBtn.setAttribute('aria-controls', 'ivpdf-audio-sidebar');
    toggleBtn.innerHTML = `<span class="ivpdf-toggle-label">${escapeHtml(startLabel)}</span>`;
    if (sidebarToggle && sidebarToggle.parentNode) {
        sidebarToggle.after(toggleBtn);
    } else if (toolbarLeft) {
        toolbarLeft.insertBefore(toggleBtn, toolbarLeft.firstChild);
    }

    // Build Left Sidebar ("Contents").
    const isSingleUngrouped = groups.length === 1 && Boolean(groups[0].ungrouped);
    const totalCountText = isSingleUngrouped
        ? (allTracks.length === 1 ? str.track : str.tracks.replace('{count}', String(allTracks.length)))
        : (groups.length === 1 ? str.lesson : str.lessons.replace('{count}', String(groups.length)));

    /**
     * Renders the page chip of a lesson or track.
     *
     * @param {number|null} page The linked page.
     * @param {number|null} lessonPage The page of the track's lesson.
     * @returns {string}
     */
    const pageChip = (page, lessonPage = null) => {
        const shown = parseInt(page, 10) || 0;
        if (!shown) {
            return canEdit
                ? `<span class="ivpdf-page-chip is-empty" title="${escapeHtml(str.notlinked)}">`
                    + `<span aria-hidden="true">—</span><span class="ivpdf-sr">${escapeHtml(str.notlinked)}</span></span>`
                : '';
        }
        const label = escapeHtml(str.pageshort.replace('{page}', String(shown)));
        if (!visiblePages.includes(shown) || shown > pdf.pagesCount) {
            const problem = escapeHtml(str.pagenotshown.replace('{page}', String(shown)));
            return canEdit
                ? `<span class="ivpdf-page-chip is-invalid" title="${problem}">${label}`
                    + `<span class="ivpdf-sr">${problem}</span></span>`
                : '';
        }
        if (!canEdit && shown === (parseInt(lessonPage, 10) || 0)) {
            return '';
        }
        return `<span class="ivpdf-page-chip">${label}</span>`;
    };

    let lessonsHtml = '';
    let runningGlobalIdx = 0;
    groups.forEach((group, gIdx) => {
        const gTracks = Array.isArray(group.tracks) ? group.tracks : [];
        const trackCountLabel = gTracks.length === 1
            ? str.track
            : str.tracks.replace('{count}', String(gTracks.length));

        let tracksHtml = '';
        gTracks.forEach((track, tIdx) => {
            const gTrackIdx = runningGlobalIdx++;
            const isFirst = gTrackIdx === 0;
            tracksHtml += `
                <div class="ivpdf-track-row" data-track-index="${gTrackIdx}">
                    <button type="button" class="ivpdf-track-item${isFirst ? ' is-active' : ''}" data-track-index="${gTrackIdx}">
                        <span class="ivpdf-track-icon">${ICONS.play}</span>
                        <span class="ivpdf-track-name">${escapeHtml(track.title || `Track ${tIdx + 1}`)}</span>
                        <span class="ivpdf-chip-slot"></span>
                    </button>
                </div>`;
        });

        lessonsHtml += `
            <div class="ivpdf-lesson-card${gIdx === 0 ? ' is-expanded is-active' : ''}" data-group-index="${gIdx}">
                <div class="ivpdf-lesson-row" data-group-index="${gIdx}">
                    <button type="button" class="ivpdf-lesson-header" data-group-index="${gIdx}">
                        <span class="ivpdf-lesson-num">${gIdx + 1}</span>
                        <span class="ivpdf-lesson-meta">
                            <div class="ivpdf-lesson-title">${escapeHtml(group.title || `Lesson ${gIdx + 1}`)}</div>
                            <div class="ivpdf-lesson-sub">
                                ${ICONS.headphones}
                                <span>${escapeHtml(trackCountLabel)}</span>
                            </div>
                        </span>
                        <span class="ivpdf-chip-slot"></span>
                        ${ICONS.chevronDown}
                    </button>
                </div>
                <div class="ivpdf-lesson-tracks">
                    ${tracksHtml}
                </div>
            </div>`;
    });

    const sidebarEl = doc.createElement('aside');
    sidebarEl.id = 'ivpdf-audio-sidebar';
    sidebarEl.innerHTML = `
        <div class="ivpdf-sidebar-header">
            <span class="ivpdf-sidebar-title">${escapeHtml(str.contents)}</span>
            <span class="ivpdf-sidebar-count">${escapeHtml(totalCountText)}</span>
        </div>
        <div class="ivpdf-lessons-list">
            ${lessonsHtml}
        </div>`;
    outerContainer.appendChild(sidebarEl);

    /**
     * The page a track opens: its own first cue. A track without one leaves the page alone.
     *
     * @param {Object} trackObj An entry of allTracks.
     * @returns {number|null}
     */
    const startPage = (trackObj) => trackObj.source.page || null;

    /**
     * Redraws every page chip from the current lesson and track pages.
     */
    const refreshChips = () => {
        sidebarEl.querySelectorAll('.ivpdf-lesson-header').forEach((header) => {
            const gIdx = parseInt(header.getAttribute('data-group-index'), 10);
            header.querySelector('.ivpdf-chip-slot').innerHTML = pageChip(groups[gIdx].page);
        });
        sidebarEl.querySelectorAll('.ivpdf-track-item').forEach((item) => {
            const trackObj = allTracks[parseInt(item.getAttribute('data-track-index'), 10)];
            item.querySelector('.ivpdf-chip-slot').innerHTML = pageChip(trackObj.source.page, groups[trackObj.groupIndex].page);
        });
    };
    refreshChips();

    if (canEdit && payload.editor) {
        initMapEditor({
            sidebarEl,
            groups,
            allTracks,
            pdf,
            visiblePages,
            editor: payload.editor,
            onChange: refreshChips,
        });
    }

    // Build Bottom Audio Player Bar.
    const formatBottomLabel = (trackObj) => {
        const trackXofY = str.trackxofy
            .replace('{current}', String(trackObj.trackIndexInGroup + 1))
            .replace('{total}', String(trackObj.groupTotalTracks));
        const isGenericTrackName = /^track\s*\d+$/i.test(trackObj.title.trim());
        const detail = isGenericTrackName ? trackXofY : `${trackObj.title} (${trackObj.trackIndexInGroup + 1}/${
            trackObj.groupTotalTracks
        })`;
        if (trackObj.ungrouped) {
            return detail;
        }
        return `${trackObj.groupTitle} · ${detail}`;
    };

    const barEl = doc.createElement('div');
    barEl.id = 'ivpdf-audio-bar';
    barEl.innerHTML = `
        <div class="ivpdf-player-info">
            <span class="ivpdf-player-badge">${ICONS.headphones}</span>
            <span class="ivpdf-player-label">${escapeHtml(formatBottomLabel(allTracks[0]))}</span>
        </div>
        <div class="ivpdf-player-center">
            <div class="ivpdf-player-controls">
                <button type="button" class="ivpdf-ctrl-btn ivpdf-btn-play" title="${escapeHtml(str.playpause)}">
                    ${ICONS.play}
                </button>
                <button type="button" class="ivpdf-ctrl-btn ivpdf-btn-goto" hidden>
                    ${ICONS.goto}
                </button>
            </div>
            <div class="ivpdf-player-timeline">
                <span class="ivpdf-time ivpdf-time-current">0:00</span>
                <input type="range" class="ivpdf-seek-slider" min="0" max="100" step="0.1" value="0">
                <span class="ivpdf-time ivpdf-time-duration">0:00</span>
            </div>
        </div>
        <div class="ivpdf-player-right">
            <button type="button" class="ivpdf-ctrl-btn ivpdf-btn-speed" title="${escapeHtml(str.playbackspeed)}">
                1x
            </button>
            <button type="button" class="ivpdf-ctrl-btn ivpdf-btn-repeat" title="${escapeHtml(str.repeat)}">
                ${ICONS.repeat}
                <span class="ivpdf-repeat-badge"></span>
            </button>
        </div>`;
    outerContainer.appendChild(barEl);

    // State & elements.
    // The element lives in the viewer's document, not the Moodle page, so it goes away with the viewer.
    const audio = doc.createElement('audio');
    audio.preload = 'metadata';
    barEl.appendChild(audio);
    audio.src = allTracks[0].url;

    let currentTrackIdx = 0;
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    let speedIdx = 0;
    const repeatModes = ['off', 'one', 'all'];
    let repeatIdx = 0;
    let isSeeking = false;

    const labelEl = barEl.querySelector('.ivpdf-player-label');
    const playBtn = barEl.querySelector('.ivpdf-btn-play');
    const gotoBtn = barEl.querySelector('.ivpdf-btn-goto');
    const speedBtn = barEl.querySelector('.ivpdf-btn-speed');
    const repeatBtn = barEl.querySelector('.ivpdf-btn-repeat');
    const repeatBadge = barEl.querySelector('.ivpdf-repeat-badge');
    const currentTimeEl = barEl.querySelector('.ivpdf-time-current');
    const durationEl = barEl.querySelector('.ivpdf-time-duration');
    const seekSlider = barEl.querySelector('.ivpdf-seek-slider');

    const jumpToMappedPage = (pageNum) => {
        const target = parseInt(pageNum, 10);
        if (!isNaN(target) && target >= 1 && target <= pdf.pagesCount && visiblePages.includes(target)) {
            pdf.currentPageNumber = target;
        }
    };

    const syncUiState = () => {
        const activeTrack = allTracks[currentTrackIdx];
        const isPlaying = !audio.paused && !audio.ended;

        labelEl.textContent = formatBottomLabel(activeTrack);
        playBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;

        // Going to the track's page is the learner's choice; a track without a page has nowhere to go.
        const page = startPage(activeTrack);
        gotoBtn.hidden = !page;
        if (page) {
            const label = str.gotopage.replace('{page}', String(page));
            gotoBtn.title = label;
            gotoBtn.setAttribute('aria-label', label);
        }

        // Update lesson cards active highlight.
        sidebarEl.querySelectorAll('.ivpdf-lesson-card').forEach((card) => {
            const gIdx = parseInt(card.getAttribute('data-group-index'), 10);
            card.classList.toggle('is-active', gIdx === activeTrack.groupIndex);
        });

        // Update track items active highlight, icon, and status badge.
        sidebarEl.querySelectorAll('.ivpdf-track-item').forEach((item) => {
            const tIdx = parseInt(item.getAttribute('data-track-index'), 10);
            const isTrackActive = tIdx === currentTrackIdx;
            item.classList.toggle('is-active', isTrackActive);
            item.classList.toggle('is-playing', isTrackActive && isPlaying);
            const iconSpan = item.querySelector('.ivpdf-track-icon');
            if (iconSpan) {
                iconSpan.innerHTML = isTrackActive && isPlaying ? ICONS.pause : ICONS.play;
            }
        });
    };

    const loadTrack = (index, autoPlay = true, jumpPage = true) => {
        if (index < 0 || index >= allTracks.length) {
            return;
        }
        currentTrackIdx = index;
        const targetTrack = allTracks[currentTrackIdx];

        // Expand parent lesson card and scroll into view.
        const parentCard = sidebarEl.querySelector(`.ivpdf-lesson-card[data-group-index="${targetTrack.groupIndex}"]`);
        if (parentCard && !parentCard.classList.contains('is-expanded')) {
            parentCard.classList.add('is-expanded');
        }

        audio.src = targetTrack.url;
        audio.playbackRate = speeds[speedIdx];
        currentTimeEl.textContent = '0:00';
        durationEl.textContent = '0:00';
        seekSlider.value = '0';
        seekSlider.style.setProperty('--seek-pct', '0%');

        if (jumpPage && startPage(targetTrack)) {
            jumpToMappedPage(startPage(targetTrack));
        }

        if (autoPlay) {
            audio.play().catch(() => {
                syncUiState();
            });
        } else {
            syncUiState();
        }
    };

    // Toggle sidebar open/closed.
    toggleBtn.addEventListener('click', () => {
        const isOpen = outerContainer.classList.toggle('ivpdf-audio-open');
        const label = isOpen ? str.hidecontents : str.showcontents;
        toggleBtn.title = label;
        toggleBtn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
        toggleBtn.classList.toggle('toggled', isOpen);
        const labelSpan = toggleBtn.querySelector('.ivpdf-toggle-label');
        if (labelSpan) {
            labelSpan.textContent = label;
        }
        setTimeout(() => {
            if (typeof pdf.update === 'function') {
                pdf.update();
            }
        }, 240);
    });

    // Lesson accordion header clicks.
    sidebarEl.querySelectorAll('.ivpdf-lesson-header').forEach((headerBtn) => {
        headerBtn.addEventListener('click', () => {
            const gIdx = parseInt(headerBtn.getAttribute('data-group-index'), 10);
            const card = headerBtn.closest('.ivpdf-lesson-card');
            if (card) {
                card.classList.toggle('is-expanded');
            }
            const group = groups[gIdx];
            if (group && group.page) {
                jumpToMappedPage(group.page);
            }
        });
    });

    // Track clicks in sidebar.
    sidebarEl.querySelectorAll('.ivpdf-track-item').forEach((trackBtn) => {
        trackBtn.addEventListener('click', () => {
            const tIdx = parseInt(trackBtn.getAttribute('data-track-index'), 10);
            if (tIdx === currentTrackIdx) {
                if (audio.paused) {
                    audio.play().catch(() => {
                        syncUiState();
                    });
                } else {
                    audio.pause();
                }
            } else {
                loadTrack(tIdx, true, true);
            }
        });
    });

    // Bottom bar controls.
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().catch(() => {
                syncUiState();
            });
        } else {
            audio.pause();
        }
    });

    gotoBtn.addEventListener('click', () => {
        jumpToMappedPage(startPage(allTracks[currentTrackIdx]));
    });

    speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        const rate = speeds[speedIdx];
        audio.playbackRate = rate;
        speedBtn.textContent = `${rate}x`;
        speedBtn.classList.toggle('is-active', rate !== 1);
    });

    repeatBtn.addEventListener('click', () => {
        repeatIdx = (repeatIdx + 1) % repeatModes.length;
        const mode = repeatModes[repeatIdx];
        repeatBtn.classList.toggle('is-active', mode !== 'off');
        repeatBadge.textContent = mode === 'one' ? '1' : '';
    });

    // Seek bar interactions.
    seekSlider.addEventListener('input', () => {
        isSeeking = true;
        const pct = parseFloat(seekSlider.value) || 0;
        seekSlider.style.setProperty('--seek-pct', `${pct}%`);
        if (isFinite(audio.duration) && audio.duration > 0) {
            currentTimeEl.textContent = formatTime((pct / 100) * audio.duration);
        }
    });

    seekSlider.addEventListener('change', () => {
        const pct = parseFloat(seekSlider.value) || 0;
        if (isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = (pct / 100) * audio.duration;
        }
        isSeeking = false;
    });

    // Audio element events.
    audio.addEventListener('play', () => {
        if (!outerContainer.classList.contains('ivpdf-bar-on')) {
            outerContainer.classList.add('ivpdf-bar-on');
            if (typeof pdf.update === 'function') {
                pdf.update();
            }
        }
        syncUiState();
    });

    /**
     * Marks the lessons and tracks linked to the page the learner is on, and brings the first into view.
     *
     * @param {number} page The current page.
     */
    const syncToPage = (page) => {
        let first = null;
        sidebarEl.querySelectorAll('.ivpdf-lesson-card').forEach((card) => {
            const onpage = groups[parseInt(card.getAttribute('data-group-index'), 10)].page === page;
            card.classList.toggle('is-onpage', onpage);
        });
        sidebarEl.querySelectorAll('.ivpdf-track-item').forEach((item) => {
            const trackObj = allTracks[parseInt(item.getAttribute('data-track-index'), 10)];
            const onpage = startPage(trackObj) === page;
            item.classList.toggle('is-onpage', onpage);
            if (onpage) {
                item.closest('.ivpdf-lesson-card').classList.add('is-expanded');
                first = first || item;
            }
        });
        first = first || sidebarEl.querySelector('.ivpdf-lesson-card.is-onpage');
        if (first) {
            first.scrollIntoView({block: 'nearest'});
        }
    };
    pdf.eventBus.on('pagechanging', (e) => syncToPage(e.pageNumber));
    syncToPage(pdf.currentPageNumber);
    audio.addEventListener('pause', syncUiState);
    audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
        if (isSeeking) {
            return;
        }
        currentTimeEl.textContent = formatTime(audio.currentTime);
        if (isFinite(audio.duration) && audio.duration > 0) {
            durationEl.textContent = formatTime(audio.duration);
            const pct = Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100));
            seekSlider.value = String(pct);
            seekSlider.style.setProperty('--seek-pct', `${pct}%`);
        }
    });
    audio.addEventListener('ended', () => {
        const mode = repeatModes[repeatIdx];
        if (mode === 'one') {
            audio.currentTime = 0;
            audio.play().catch(() => {
                syncUiState();
            });
        } else if (mode === 'all') {
            // Only an explicit "repeat all" plays on by itself.
            loadTrack(currentTrackIdx < allTracks.length - 1 ? currentTrackIdx + 1 : 0, true, false);
        } else {
            // Otherwise stop at the end of the track; the learner starts the next one.
            syncUiState();
        }
    });

    /**
     * Stops playback and releases the media, so nothing keeps playing or downloading.
     */
    const destroyAudio = () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    };

    // The viewer document is unloaded when its iframe is removed or replaced.
    iframe.contentWindow.addEventListener('pagehide', destroyAudio);

    // Closing or refreshing the interaction only pauses: a cached interaction reopens with this same viewer.
    $(document).on(`interactionclose${ns} interactionrefresh${ns}`, (e) => {
        if (!e.detail || !e.detail.annotation || e.detail.annotation.id == annotationId) {
            audio.pause();
        }
    });

    // Catch any removal the events above miss: stop once the iframe is no longer in the page.
    const observer = new MutationObserver(() => {
        if (!iframe.isConnected) {
            destroyAudio();
            observer.disconnect();
        }
    });
    observer.observe(document.body, {childList: true, subtree: true});
};

/**
 * Monitors a PDF viewer within an iframe and toggles completion status based on the number of pages viewed.
 *
 * @param {Object} annotation - The annotation object containing the ID and completion status.
 * @param {string} log - The log data for the annotation.
 * @param {boolean} getLog - Flag indicating whether to retrieve the log.
 * @param {Object} adv - Advanced settings.
 * @param {Object} instance - The calling class instance.
 * @returns {void}
 */
export const pdfCheck = (annotation, log, getLog, adv, instance) => {
    let retries = 0;
    const maxRetries = 500; // Stop polling after ~8-10 seconds if iframe doesn't respond.

    const checkIframe = () => {
        const iframe = document.querySelector(`#message[data-id='${annotation.id}'] iframe`);
        if (iframe) {
            injectGoogleFont(iframe);
        }
        let pdf;
        try {
            pdf = iframe?.contentWindow?.PDFViewerApplication?.pdfViewer;
        } catch (e) {
            pdf = null;
        }

        if (pdf && pdf.pagesCount > 0) {
            let pageToDisplay = annotation.char1; // Format 1-3,10.

            // Build an array of pages to display with robust parsing.
            let pages = [];
            if (pageToDisplay && pageToDisplay.trim() !== "") {
                pages = pageToDisplay.split(",").map((p) => {
                    let range = p.trim().split("-");
                    if (range.length > 1) {
                        const start = parseInt(range[0]);
                        const end = parseInt(range[1]);
                        return Array.from({length: end - start + 1}, (_, i) => i + start);
                    } else {
                        return parseInt(p.trim());
                    }
                }).flat().filter(n => !isNaN(n));
            } else {
                pages = Array.from({length: pdf.pagesCount}, (_, i) => i + 1);
            }

            // Get the pages to remove/hide.
            let pagesToRemove = [];
            for (let i = 1; i <= pdf.pagesCount; i++) {
                if (!pages.includes(i)) {
                    pagesToRemove.push(i);
                }
            }
            const lastPage = Math.max(...pages);

            // Namespace events to prevent listener accumulation on the document.
            const ns = `.pdfviewer_${annotation.id}`;
            $(document).off(`interactionclose${ns} interactionrefresh${ns}`);

            let pagesLoadedHandled = false;
            const onPagesLoaded = function() {
                if (pagesLoadedHandled) {
                    return;
                }
                pagesLoadedHandled = true;

                let windowDocument = iframe.contentWindow.document;
                if (adv.hidetools == 1) {
                    let toolbar = windowDocument.querySelectorAll(
                        `#toolbarViewerRight > *:not(#secondaryToolbarToggle):not(#ivpdf-toggle-contents),` +
                        ` #secondaryOpenFile, #secondaryPrint, #secondaryDownload`
                    );
                    toolbar.forEach((element) => element.remove());

                    const viewerWindow = iframe.contentWindow;

                    // No keyboard in the viewer: shortcuts would save, print or open files. Plain typing in a
                    // field (page number, find) still works. The capture phase runs before PDF.js's handlers.
                    const blockKeys = (e) => {
                        const typing = e.target.closest?.('input, textarea, select');
                        if (!typing || e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        }
                    };
                    ['keydown', 'keypress', 'keyup'].forEach((type) => viewerWindow.addEventListener(type, blockKeys, true));

                    // Printing from the browser menu bypasses the keyboard: PDF.js renders every page for print.
                    // Stub its print entry point and print blank, both in the viewer and from the parent page.
                    viewerWindow.print = () => undefined;
                    const noPrint = windowDocument.createElement('style');
                    noPrint.textContent = '@media print { body > *, #printContainer { display: none !important; } }';
                    windowDocument.head.appendChild(noPrint);
                    if (!document.getElementById(`ivpdf-noprint-${annotation.id}`)) {
                        const parentNoPrint = document.createElement('style');
                        parentNoPrint.id = `ivpdf-noprint-${annotation.id}`;
                        parentNoPrint.textContent = `@media print { #message[data-id='${annotation.id}'] iframe `
                            + '{ visibility: hidden !important; } }';
                        document.head.appendChild(parentNoPrint);
                    }
                }

                // Apply Google Font if configured in site settings.
                injectGoogleFont(iframe);

                // Initialize audio accompaniment UI if audio tracks are present.
                const isEditMode = typeof instance?.isEditMode === 'function' && instance.isEditMode();
                initAudioPlayer(iframe, pdf, pages, ns, annotation.id, isEditMode);

                pagesToRemove.forEach((page) => {
                    let pageElement = windowDocument.querySelector(`.page[data-page-number='${page}']`);
                    if (pageElement) {
                        pageElement.style.height = "0";
                        pageElement.style.margin = "0";
                        pageElement.style.border = "0";
                        $(pageElement).empty();
                    }
                    let thumbnailElement = windowDocument.querySelector(`.thumbnail[data-page-number='${page}']`);
                    if (thumbnailElement) {
                        thumbnailElement.style.height = "0";
                        thumbnailElement.style.margin = "0";
                        thumbnailElement.style.border = "0";
                        thumbnailElement.style.overflow = "hidden";
                        // Hide <a> parent.
                        let parent = thumbnailElement.parentElement;
                        if (parent) {
                            parent.style.display = "none";
                        }
                    }
                });

                // Tell PDF.js to recalculate its internal layout/scroll positions.
                if (typeof pdf.update === 'function') {
                    pdf.update();
                }

                // Add scroll listener to detect reaching the last page/bottom.
                if (!instance.isEditMode()) {
                    const viewerContainer = windowDocument.getElementById('viewerContainer');
                    if (viewerContainer) {
                        viewerContainer.addEventListener('scroll', function() {
                            // Calculate which visible page is currently most prominent in the viewport.
                            let activePage = lastPage;
                            let maxVisibleHeight = 0;
                            const containerRect = viewerContainer.getBoundingClientRect();

                            pages.forEach(function(p) {
                                const pageEl = windowDocument.querySelector(`.page[data-page-number='${p}']`);
                                if (pageEl) {
                                    const rect = pageEl.getBoundingClientRect();
                                    const visibleTop = Math.max(rect.top, containerRect.top);
                                    const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
                                    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
                                    if (visibleHeight > maxVisibleHeight) {
                                        maxVisibleHeight = visibleHeight;
                                        activePage = p;
                                    }
                                }
                            });

                            if (activePage && activePage !== pdf.currentPageNumber) {
                                pdf._currentPageNumber = activePage;

                                // Synchronize with Flexbook state directly.
                                if (instance.isFlexbook && getLog) {
                                    const state = instance.state;
                                    if (state && state.interactionData) {
                                        if (!state.interactionData[annotation.id]) {
                                            state.interactionData[annotation.id] = {t: 0, v: 0};
                                        }
                                        state.interactionData[annotation.id].pdf = activePage;
                                    }
                                }

                                // Trigger pagechanging event on the eventBus so PDF.js UI updates as well!
                                if (pdf.eventBus && typeof pdf.eventBus.dispatch === 'function') {
                                    try {
                                        pdf.eventBus.dispatch('pagechanging', {
                                            pageNumber: activePage,
                                            source: pdf
                                        });
                                    } catch (e) {
                                        // Ignore.
                                    }
                                }
                            }

                            if (!annotation.completed && annotation.completiontracking == 'scrolltolastpage') {
                                const threshold = 50; // 50px tolerance
                                const scrolledToBottom = viewerContainer.scrollHeight -
                                    viewerContainer.scrollTop -
                                    viewerContainer.clientHeight < threshold;
                                if (scrolledToBottom) {
                                    instance.toggleCompletion(annotation.id, "mark-done", "automatic");
                                    annotation.completed = true;
                                }
                            }
                        });
                    }
                }
            };

            pdf.eventBus.on("pagesloaded", onPagesLoaded);
            if (pdf.pagesPromise && typeof pdf.pagesPromise.then === 'function') {
                pdf.pagesPromise.then(onPagesLoaded).catch(() => {
                    // Ignore.
                });
            } else if (pdf._pagesCapability?.promise) {
                pdf._pagesCapability.promise.then(onPagesLoaded).catch(() => {
                    // Ignore.
                });
            }

            if (log != '') {
                pdf.currentPageNumber = Number(log);
            }

            if (instance.isFlexbook && getLog) {
                pdf.eventBus.on("pagechanging", function(e) {
                    const state = instance.state;
                    if (state && state.interactionData) {
                        if (!state.interactionData[annotation.id]) {
                            state.interactionData[annotation.id] = {t: 0, v: 0};
                        }
                        state.interactionData[annotation.id].pdf = e.pageNumber;
                    }
                });
            }

            if (getLog && !instance.isFlexbook) {
                let savedpage = log;
                $(document).on(`interactionclose${ns} interactionrefresh${ns}`, async function(e) {
                    if (e.detail.annotation.id == annotation.id && savedpage != pdf.currentPageNumber) {
                        try {
                            let page = pdf.currentPageNumber;
                            let logResponse = await instance.saveLog(annotation, {
                                text1: page,
                                char1: annotation.type,
                            }, instance.userid, true);

                            if (logResponse && logResponse.data) {
                                let logData = JSON.parse(logResponse.data);
                                savedpage = logData.text1;
                            } else {
                                savedpage = page;
                            }
                        } catch (e) {
                            window.console.log('Error saving PDF log: ', e);
                        }
                    }
                });
            }

            if (instance.isEditMode()) {
                return;
            }

            if ((pdf.pagesCount === 1 || pdf._pages.length === 1 || pages.length <= 1)
                && !annotation.completed && annotation.completiontracking == 'scrolltolastpage') {
                instance.toggleCompletion(annotation.id, "mark-done", "automatic");
            }
        } else if (retries < maxRetries) {
            retries++;
            requestAnimationFrame(checkIframe);
        }
    };
    requestAnimationFrame(checkIframe);
};
