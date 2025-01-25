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
        /**
         * Monitors a PDF viewer within an iframe and toggles completion status based on the number of pages viewed.
         *
         * @param {Object} annotation - The annotation object containing the ID and completion status.
         * @returns {void}
         */
        const pdfCheck = (annotation) => {
            const checkIframe = () => {
                const iframe = document.querySelector(`#message[data-id='${annotation.id}'] iframe`);
                let pdf;
                try {
                    pdf = iframe.contentWindow.PDFViewerApplication.pdfViewer;
                } catch (e) {
                    pdf = null;
                }
                if (pdf && pdf.pagesCount > 0) {
                    window.console.log("PDF viewer loaded.");
                    if (pdf.pagesCount === 1 || pdf._pages.length === 1) { // Only one page.
                        self.toggleCompletion(annotation.id, "mark-done", "automatic");
                    } else {
                        pdf.eventBus.on("pagechanging", function(e) {
                            if (e.pageNumber == pdf.pagesCount && !annotation.completed) {
                                self.toggleCompletion(annotation.id, "mark-done", "automatic");
                                annotation.completed = true;
                                // Unbind the event listener.
                                pdf.eventBus.off("pagechanging");
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
        if (annotation.hascompletion == 0 || annotation.completed) {
            return;
        }
        if (annotation.completiontracking == 'view') {
            this.toggleCompletion(annotation.id, "mark-done", "automatic");
            return;
        }
        if (annotation.completiontracking == 'scrolltolastpage') {
            pdfCheck(annotation);
        }
    }
}