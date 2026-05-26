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
import {pdfCheck} from 'local_ivpdfviewer/utils';


export default class PdfViewer extends Iframe {
    /**
     * Called when the edit form is loaded.
     * @return {void}
     */
    onEditFormLoaded() {
        // Do nothing.
    }
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

        // We don't need to run the render method every time the content is applied. We can cache the content.
        if (!self.cache[annotation.id] || self.isEditMode()) {
            self.cache[annotation.id] = await this.render(annotation, 'html');
        }
        const data = self.cache[annotation.id];

        $(`#message[data-id='${annotation.id}'] .modal-body`).attr('id', 'content').html(data).fadeIn(300);
        this.postContentRender(annotation);
        if (self.isEditMode()) {
            pdfCheck(annotation, '', false, adv, self);
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
        pdfCheck(annotation, log, getLog, adv, self);
        if (annotation.hascompletion == 0 || annotation.completed) {
            return;
        }
        this.completiononview(annotation);
    }

    /**
     * Override the displayReportView method.
     *
     * @param {Object} annotation - The annotation object.
     * @returns {void}
     */
    async displayReportView(annotation) {
        await super.displayReportView(annotation);
        let adv = JSON.parse(annotation.advanced);
        pdfCheck(annotation, '', false, adv, this);
    }
}