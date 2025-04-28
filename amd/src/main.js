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
 * PDF viewer
 *
 * @module     local_ivpdfviewer/main
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import $ from 'jquery';
import Iframe from 'ivplugin_iframe/main';

export default class PdfViewer extends Iframe {
    /**
     * Renders the container for the given annotation.
     *
     * @param {Object} annotation - The annotation object.
     * @param {string} annotation.id - The ID of the annotation.
     */
    renderContainer(annotation) {
        let $message = $(`#message[data-id='${annotation.id}']`);
        $message.addClass("hasiframe");
        super.renderContainer(annotation);
    }

    /**
     * Renders the content for the given annotation.
     * @param {Object} annotation - The annotation object.
     * @returns {Promise} - The promise object representing the content rendering.
     */
    async applyContent(annotation) {
        let self = this;
        let adv = JSON.parse(annotation.advanced);
        /**
         * Monitors a PDF viewer within an iframe and toggles completion status based on the number of pages viewed.
         *
         * @param {Object} annotation - The annotation object containing the ID and completion status.
         * @param {string} log - The log data for the annotation.
         * @param {boolean} getLog - Flag indicating whether to retrieve the log.
         * @returns {void}
         */
        const pdfCheck = (annotation, log, getLog) => {
            const checkIframe = () => {
                const iframe = document.querySelector(`#message[data-id='${annotation.id}'] iframe`);
                let pdf;
                try {
                    pdf = iframe.contentWindow.PDFViewerApplication.pdfViewer;
                } catch (e) {
                    pdf = null;
                }
                if (pdf && pdf.pagesCount > 0) {
                    window.pdf = pdf;
                    let pageToDisplay = annotation.char1; // Format 1-3,10.
                    // Let's build an array of pages to display.
                    let pages = [];
                    if (pageToDisplay && pageToDisplay !== "") {
                        pages = pageToDisplay.split(",").map((page) => {
                            let range = page.split("-");
                            if (range.length > 1) {
                                return Array.from({length: range[1] - range[0] + 1}, (_, i) => i + parseInt(range[0]));
                            } else {
                                return parseInt(page);
                            }
                        }).flat();
                    } else {
                        pages = Array.from({length: pdf.pagesCount}, (_, i) => i + 1);
                    }
                    // Get the pages to remove.
                    let pagesToRemove = [];
                    for (let i = 1; i <= pdf.pagesCount; i++) {
                        if (!pages.includes(i)) {
                            pagesToRemove.push(i);
                        }
                    }
                    const lastPage = Math.max(...pages);
                    pdf.eventBus.on("pagesloaded", function() {
                        let windowDocument = iframe.contentWindow.document;
                        if (adv.hidetools) {
                            let toolbar = windowDocument.querySelectorAll(`#toolbarViewerRight > *:not(#secondaryToolbarToggle),
                                 #secondaryOpenFile, #secondaryPrint, #secondaryDownload`);
                            if (toolbar.length > 0) {
                                toolbar.forEach((element) => {
                                    element.remove();
                                });
                            }
                        }
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
                    });

                    if (log != '') { // Log is the last page viewed.
                        pdf.currentPageNumber = Number(log);
                    }

                    if (getLog) {
                        $(document).on('interactionclose interactionrefresh', async function(e) {
                            if (e.detail.annotation.id == annotation.id) {
                                try {
                                    let page = window.pdf.currentPageNumber;
                                    await self.saveLog(annotation, {
                                        text1: page,
                                        char1: annotation.type,
                                    }, self.userid, true);
                                } catch (e) {
                                    window.console.log('Error: ', e);
                                }
                            }
                        });
                    }

                    if (self.isEditMode()) {
                        return;
                    }

                    if ((pdf.pagesCount === 1 || pdf._pages.length === 1 || pages.length <= 1)
                        && !annotation.completed && annotation.completiontracking == 'scrolltolastpage') { // Only one page.
                        self.toggleCompletion(annotation.id, "mark-done", "automatic");
                    } else {
                        pdf.eventBus.on("pagechanging", function(e) {
                            if (!annotation.completed && annotation.completiontracking == 'scrolltolastpage') {
                                if (e.pageNumber == lastPage && !annotation.completed) {
                                    self.toggleCompletion(annotation.id, "mark-done", "automatic");
                                    annotation.completed = true;
                                }
                            }
                        });
                    }
                } else {
                    requestAnimationFrame(checkIframe);
                }
            };
            requestAnimationFrame(checkIframe);
        };

        // We don't need to run the render method every time the content is applied. We can cache the content.
        if (!self.cache[annotation.id] || self.isEditMode()) {
            self.cache[annotation.id] = await this.render(annotation, 'html');
        }
        const data = self.cache[annotation.id];

        $(`#message[data-id='${annotation.id}'] .modal-body`).attr('id', 'content').html(data).fadeIn(300);
        this.postContentRender(annotation);
        if (self.isEditMode()) {
            pdfCheck(annotation, '', false);
            return;
        }
        let log = '';
        let getLog = false;
        if (adv.savepagebefore && adv.savepagebefore != 0 && annotation.completed == false) {
            getLog = true;
        }
        if (adv.savepageafter && adv.savepageafter != 0 && annotation.completed == true) {
            getLog = true;
        }
        if (getLog) {
            log = await self.getLogs(annotation, [self.userid]);
            if (log.length > 0) {
                log = log[0].text1;
            }
        }
        pdfCheck(annotation, log, getLog);
        if (annotation.hascompletion == 0 || annotation.completed) {
            return;
        }
        if (annotation.completiontracking == 'view') {
            this.toggleCompletion(annotation.id, "mark-done", "automatic");
            return;
        }
    }
}