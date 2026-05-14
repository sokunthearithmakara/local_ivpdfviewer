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

            pdf.eventBus.on("pagesloaded", function() {
                let windowDocument = iframe.contentWindow.document;
                if (adv.hidetools == 1) {
                    let toolbar = windowDocument.querySelectorAll(`#toolbarViewerRight > *:not(#secondaryToolbarToggle),
                         #secondaryOpenFile, #secondaryPrint, #secondaryDownload`);
                    toolbar.forEach((element) => element.remove());
                }

                // Inject CSS to hide pages and thumbnails completely.
                // This is more efficient and removes the empty space more reliably than manual style updates.
                const styleId = 'pdf-hide-pages-style';
                let existingStyle = windowDocument.getElementById(styleId);
                if (existingStyle) {
                    existingStyle.remove();
                }

                const style = windowDocument.createElement('style');
                style.id = styleId;
                style.innerHTML = pagesToRemove.map(page => `
                    .page[data-page-number='${page}'],
                    .thumbnail[data-page-number='${page}'] {
                        display: none !important;
                    }
                `).join('\n');
                windowDocument.head.appendChild(style);

                // Additional cleanup for thumbnail wrappers which often cause extra spacing.
                pagesToRemove.forEach((page) => {
                    let thumbnailElement = windowDocument.querySelector(`.thumbnail[data-page-number='${page}']`);
                    if (thumbnailElement) {
                        let parent = thumbnailElement.parentElement;
                        if (parent && (parent.tagName === 'A' || parent.classList.contains('thumbnailContainer'))) {
                            parent.style.setProperty('display', 'none', 'important');
                        }
                    }
                });

                // Tell PDF.js to recalculate its internal layout/scroll positions.
                if (typeof pdf.update === 'function') {
                    pdf.update();
                }
            });

            if (log != '') {
                pdf.currentPageNumber = Number(log);
            }

            // Namespace events to prevent listener accumulation on the document.
            const ns = `.pdfviewer_${annotation.id}`;
            $(document).off(`interactionclose${ns} interactionrefresh${ns}`);

            if (getLog) {
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
            } else {
                pdf.eventBus.on("pagechanging", function(e) {
                    if (!annotation.completed && annotation.completiontracking == 'scrolltolastpage') {
                        if (e.pageNumber == lastPage && !annotation.completed) {
                            instance.toggleCompletion(annotation.id, "mark-done", "automatic");
                            annotation.completed = true;
                        }
                    }
                });
            }
        } else if (retries < maxRetries) {
            retries++;
            requestAnimationFrame(checkIframe);
        }
    };
    requestAnimationFrame(checkIframe);
};
