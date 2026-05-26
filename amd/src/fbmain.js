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
 * @module     local_ivpdfviewer/fbmain
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import Iframe from 'ivplugin_iframe/fbmain';
import Ajax from 'core/ajax';
import {safeParse} from 'mod_flexbook/utils';

import {pdfCheck} from 'local_ivpdfviewer/utils';
import state from 'mod_flexbook/state';

export default class PdfViewer extends Iframe {
    /**
     * Called when the edit form is loaded.
     * @return {void}
     */
    onEditFormLoaded() {
        // Do nothing.
    }
    /**
     * Renders the content for the given annotation.
     * @param {Object} annotation - The annotation object.
     * @param {Object} $message - The message object.
     * @returns {Promise} - The promise object representing the content rendering.
     */
    async applyContent(annotation, $message = null) {
        let self = this;
        let adv = JSON.parse(annotation.advanced);

        self.isFlexbook = true;
        self.state = state;

        // We don't need to run the render method every time the content is applied. We can cache the content.
        if (!self.cache[annotation.id] || self.isEditMode()) {
            self.cache[annotation.id] = await this.render(annotation, 'html');
        }
        const data = self.cache[annotation.id];

        $message.find('.modal-body').attr('id', 'content').html(data).fadeIn(300);
        this.postContentRender(annotation, $message);
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
            if (state.interactionData && state.interactionData[annotation.id] && state.interactionData[annotation.id].pdf) {
                log = state.interactionData[annotation.id].pdf;
            }
        }
        pdfCheck(annotation, log, getLog, adv, self);
        if (annotation.hascompletion == 0 || annotation.completed) {
            return;
        }

        this.completiononview(annotation);

    }


    /**
     * Handle drag and drop creation.
     *
     * @param {Array} annotations
     * @param {File} file
     * @param {Object} response
     * @param {number} anchorid
     */
    async dnd(annotations, file, response, anchorid = 0) {
        const result = await Ajax.call([{
            methodname: 'mod_flexbook_create_interaction',
            args: {
                contextid: M.cfg.contextid,
                courseid: this.course,
                cmid: this.cm,
                annotationid: this.flexbook,
                type: this.prop.name,
                title: file.name.replace(/\.[^/.]+$/, ""),
                draftitemid: response.draftitemid || 0,
                anchorid: anchorid
            }
        }])[0];

        const newItem = safeParse(result.data, {});
        this.dispatchEvent('annotationupdated', {
            annotation: newItem,
            action: 'add',
            anchorid: anchorid,
            isDnD: true
        });
    }

    /**
     * Override the displayReportView method.
     *
     * @param {Object} annotation - The annotation object.
     * @param {Array} tabledatajson - The table data json.
     * @param {Object} DataTable - The data table.
     * @param {jQuery} root - The root element.
     * @returns {void}
     */
    async displayReportView(annotation, tabledatajson, DataTable, root) {
        await super.displayReportView(annotation, tabledatajson, DataTable, root);
        let adv = JSON.parse(annotation.advanced);
        pdfCheck(annotation, '', false, adv, this);
    }
}