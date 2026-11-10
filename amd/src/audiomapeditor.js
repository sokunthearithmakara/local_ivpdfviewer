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
 * Edit mode for the audio Contents sidebar: link lessons and tracks to the page on screen.
 *
 * Editors browse the PDF and play the audio as learners would, then link a lesson or track to
 * the current page. Changes stay local until Save, which replaces the stored map.
 *
 * @module     local_ivpdfviewer/audiomapeditor
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import Ajax from 'core/ajax';
import Notification from 'core/notification';
import {add as addToast} from 'core/toast';

const ICONS = {
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"` +
        ` stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/>` +
        `<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"` +
        ` stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>` +
        `<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`,
    unlink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"` +
        ` stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/>` +
        `<line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

const STYLES = `
.ivpdf-edit-toggle,
.ivpdf-edit-btn {
    border: 0;
    border-radius: 2px;
    background: none;
    color: var(--main-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: default;
    flex-shrink: 0;
}
.ivpdf-edit-toggle {
    width: 24px;
    height: 24px;
    margin-inline-start: 6px;
}
.ivpdf-edit-btn {
    width: 24px;
    height: 24px;
}
.ivpdf-edit-toggle svg,
.ivpdf-edit-btn svg {
    width: 14px;
    height: 14px;
    opacity: var(--toolbar-icon-opacity, 0.7);
}
.ivpdf-edit-toggle:hover,
.ivpdf-edit-toggle:focus-visible,
.ivpdf-edit-btn:hover,
.ivpdf-edit-btn:focus-visible {
    background-color: var(--button-hover-color);
}
.ivpdf-edit-toggle[aria-pressed="true"] {
    background-color: var(--toggled-btn-bg-color);
}
.ivpdf-edit-btn[disabled] {
    opacity: 0.35;
}
.ivpdf-edit-btn[hidden] {
    visibility: hidden;
    display: inline-flex;
}
.ivpdf-sidebar-header .ivpdf-sidebar-count {
    margin-inline-start: auto;
}
.ivpdf-edit-actions {
    display: none;
    flex-shrink: 0;
}
#ivpdf-audio-sidebar.is-editing .ivpdf-edit-actions {
    display: inline-flex;
}
.ivpdf-edit-footer {
    display: none;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-top: 1px solid var(--toolbar-border-color, rgba(0, 0, 0, 0.2));
    background-color: var(--sidebar-toolbar-bg-color);
    flex-shrink: 0;
}
#ivpdf-audio-sidebar.is-editing .ivpdf-edit-footer {
    display: flex;
}
.ivpdf-edit-status {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    color: var(--ivpdf-muted);
}
.ivpdf-edit-footer button {
    border: 1px solid var(--ivpdf-muted);
    border-radius: 2px;
    background: transparent;
    color: var(--main-color);
    font: inherit;
    font-size: 12px;
    padding: 3px 10px;
}
.ivpdf-edit-footer .ivpdf-edit-save {
    border-color: var(--ivpdf-accent);
    background-color: var(--ivpdf-accent);
    color: #ffffff;
}
.ivpdf-edit-footer button[disabled] {
    opacity: 0.5;
}
`;

/**
 * Track cues without the one that opens the track (t = 0).
 *
 * @param {Object} track A payload track.
 * @returns {Array}
 */
const laterCues = (track) => (Array.isArray(track.cues) ? track.cues : []).filter((cue) => Number(cue.t) !== 0);

/**
 * Whether a track has a page of its own (a cue at the start).
 *
 * @param {Object} track A payload track.
 * @returns {boolean}
 */
const hasStartCue = (track) => (Array.isArray(track.cues) ? track.cues : []).some((cue) => Number(cue.t) === 0);

/**
 * Sets a track's cues and the page it opens.
 *
 * @param {Object} track A payload track.
 * @param {Array} cues
 */
const setCues = (track, cues) => {
    track.cues = cues.slice().sort((a, b) => a.t - b.t);
    track.page = track.cues.length ? track.cues[0].page : null;
};

/**
 * Adds edit mode to the Contents sidebar.
 *
 * @param {Object} options
 * @param {HTMLElement} options.sidebarEl The Contents sidebar.
 * @param {Array} options.groups Payload lessons; their page and tracks are edited in place.
 * @param {Array} options.allTracks Flattened tracks, each with source (payload track) and groupIndex.
 * @param {Object} options.pdf PDFViewerApplication.pdfViewer.
 * @param {Array<number>} options.visiblePages Pages the item shows.
 * @param {Object} options.editor contextid, itemid, plugin and strings from the server.
 * @param {Function} options.onChange Redraws the chips after a change.
 */
export const init = ({sidebarEl, groups, allTracks, pdf, visiblePages, editor, onChange}) => {
    const doc = sidebarEl.ownerDocument;
    const str = editor.strings || {};

    if (!doc.getElementById('ivpdf-audio-editor-styles')) {
        const styleEl = doc.createElement('style');
        styleEl.id = 'ivpdf-audio-editor-styles';
        styleEl.textContent = STYLES;
        doc.head.appendChild(styleEl);
    }

    const snapshot = () => JSON.stringify({
        groups: groups.map((group) => group.page || null),
        tracks: allTracks.map((trackObj) => trackObj.source.cues || []),
    });
    let baseline = snapshot();

    const restore = (saved) => {
        const state = JSON.parse(saved);
        groups.forEach((group, i) => {
            group.page = state.groups[i];
        });
        allTracks.forEach((trackObj, i) => setCues(trackObj.source, state.tracks[i]));
    };

    // Header toggle.
    const toggle = doc.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ivpdf-edit-toggle';
    toggle.title = str.editpagelinks;
    toggle.setAttribute('aria-label', str.editpagelinks);
    toggle.setAttribute('aria-pressed', 'false');
    toggle.innerHTML = ICONS.edit;
    sidebarEl.querySelector('.ivpdf-sidebar-header').appendChild(toggle);

    // Footer with status, Cancel and Save.
    const footer = doc.createElement('div');
    footer.className = 'ivpdf-edit-footer';
    footer.innerHTML = `
        <span class="ivpdf-edit-status" role="status" aria-live="polite"></span>
        <button type="button" class="ivpdf-edit-cancel"></button>
        <button type="button" class="ivpdf-edit-save"></button>`;
    const status = footer.querySelector('.ivpdf-edit-status');
    const cancelBtn = footer.querySelector('.ivpdf-edit-cancel');
    const saveBtn = footer.querySelector('.ivpdf-edit-save');
    cancelBtn.textContent = str.cancel;
    saveBtn.textContent = str.savechanges;
    sidebarEl.appendChild(footer);

    // Link and unlink buttons beside every lesson and track row.
    const addActions = (row, kind, index) => {
        const actions = doc.createElement('span');
        actions.className = 'ivpdf-edit-actions';
        actions.innerHTML = `
            <button type="button" class="ivpdf-edit-btn ivpdf-link-btn">${ICONS.link}</button>
            <button type="button" class="ivpdf-edit-btn ivpdf-unlink-btn">${ICONS.unlink}</button>`;
        actions.querySelectorAll('button').forEach((button) => {
            button.dataset.kind = kind;
            button.dataset.index = String(index);
        });
        const unlinkBtn = actions.querySelector('.ivpdf-unlink-btn');
        unlinkBtn.title = str.removepagelink;
        unlinkBtn.setAttribute('aria-label', str.removepagelink);
        row.appendChild(actions);
    };
    sidebarEl.querySelectorAll('.ivpdf-lesson-row').forEach((row) => {
        addActions(row, 'group', parseInt(row.getAttribute('data-group-index'), 10));
    });
    sidebarEl.querySelectorAll('.ivpdf-track-row').forEach((row) => {
        addActions(row, 'track', parseInt(row.getAttribute('data-track-index'), 10));
    });

    const currentPage = () => {
        const page = parseInt(pdf.currentPageNumber, 10);
        return page >= 1 && page <= pdf.pagesCount && visiblePages.includes(page) ? page : 0;
    };

    const isLinked = (kind, index) => (kind === 'group'
        ? Boolean(groups[index].page)
        : hasStartCue(allTracks[index].source));

    const refreshButtons = () => {
        const page = currentPage();
        const label = (str.linktopage || '').replace('{page}', String(page));
        sidebarEl.querySelectorAll('.ivpdf-link-btn').forEach((button) => {
            button.disabled = !page;
            button.title = label;
            button.setAttribute('aria-label', label);
        });
        sidebarEl.querySelectorAll('.ivpdf-unlink-btn').forEach((button) => {
            button.hidden = !isLinked(button.dataset.kind, parseInt(button.dataset.index, 10));
        });
        const dirty = snapshot() !== baseline;
        saveBtn.disabled = !dirty;
        status.textContent = dirty ? str.unsavedpagelinks : '';
    };

    const changed = () => {
        onChange();
        refreshButtons();
    };

    const setEditing = (editing) => {
        sidebarEl.classList.toggle('is-editing', editing);
        toggle.setAttribute('aria-pressed', editing ? 'true' : 'false');
        toggle.hidden = editing;
        if (editing) {
            // Every row should be reachable while linking.
            sidebarEl.querySelectorAll('.ivpdf-lesson-card').forEach((card) => card.classList.add('is-expanded'));
            refreshButtons();
        }
    };

    sidebarEl.addEventListener('click', (e) => {
        const button = e.target.closest('.ivpdf-link-btn, .ivpdf-unlink-btn');
        if (!button || !sidebarEl.contains(button)) {
            return;
        }
        const kind = button.dataset.kind;
        const index = parseInt(button.dataset.index, 10);
        const page = button.classList.contains('ivpdf-link-btn') ? currentPage() : 0;
        if (button.classList.contains('ivpdf-link-btn') && !page) {
            return;
        }
        if (kind === 'group') {
            groups[index].page = page || null;
        } else {
            const track = allTracks[index].source;
            setCues(track, page ? [{t: 0, page}, ...laterCues(track)] : laterCues(track));
        }
        changed();
    });

    toggle.addEventListener('click', () => setEditing(true));

    cancelBtn.addEventListener('click', () => {
        restore(baseline);
        changed();
        setEditing(false);
    });

    saveBtn.addEventListener('click', () => {
        saveBtn.disabled = true;
        const args = {
            contextid: editor.contextid,
            itemid: editor.itemid,
            plugin: editor.plugin,
            groups: groups.filter((group) => group.page).map((group) => ({path: group.key, page: group.page})),
            tracks: allTracks
                .filter((trackObj) => (trackObj.source.cues || []).length)
                .map((trackObj) => ({
                    path: trackObj.source.key,
                    cues: trackObj.source.cues.map((cue) => ({t: Number(cue.t), page: cue.page})),
                })),
        };
        Ajax.call([{methodname: 'local_ivpdfviewer_save_audio_map', args}])[0]
            .then((result) => {
                // The server may have dropped links to deleted files, so show what it stored.
                const grouppages = {};
                result.groups.forEach((group) => {
                    grouppages[group.path] = group.page;
                });
                const trackcues = {};
                result.tracks.forEach((track) => {
                    trackcues[track.path] = track.cues;
                });
                groups.forEach((group) => {
                    group.page = grouppages[group.key] || null;
                });
                allTracks.forEach((trackObj) => setCues(trackObj.source, trackcues[trackObj.source.key] || []));
                baseline = snapshot();
                changed();
                setEditing(false);
                addToast(result.skipped
                    ? str.pagelinksskipped.replace('{count}', String(result.skipped))
                    : str.pagelinkssaved);
                return result;
            })
            .catch((error) => {
                refreshButtons();
                Notification.exception(error);
            });
    });

    // The link buttons name the page on screen.
    if (pdf.eventBus) {
        pdf.eventBus.on('pagechanging', () => {
            if (sidebarEl.classList.contains('is-editing')) {
                refreshButtons();
            }
        });
    }
};
