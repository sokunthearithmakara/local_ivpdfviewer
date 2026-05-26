<?php
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

namespace local_ivpdfviewer;

/**
 * Helper class for PDF viewer plugin.
 *
 * @package    local_ivpdfviewer
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class helper {
    /**
     * Normalizes iframeurl values loaded from the database.
     *
     * @param mixed $iframeurl
     * @return string
     */
    public static function normalize_iframeurl($iframeurl) {
        if ($iframeurl === null || $iframeurl === 'null') {
            return '';
        }
        return (string) $iframeurl;
    }

    /**
     * Adds the PDF viewer elements to a moodleform.
     *
     * @param \MoodleQuickForm $mform The form to add elements to.
     */
    public static function add_pdfviewer_elements(&$mform) {
        global $PAGE;

        $mform->addElement('text', 'title', '<i class="bi bi-quote iv-mr-2"></i>' . get_string('title', 'mod_interactivevideo'));
        $mform->setType('title', PARAM_TEXT);
        $mform->setDefault('title', get_string('defaulttitle', 'mod_interactivevideo'));
        $mform->addRule('title', get_string('required'), 'required', null, 'client');

        // Source type.
        $sourcetypes = [
            'file' => get_string('sourcefile', 'local_ivpdfviewer'),
            'url' => get_string('sourceurl', 'local_ivpdfviewer'),
        ];
        $mform->addElement(
            'select',
            'char2',
            '<i class="bi bi-box-arrow-in-right iv-mr-2"></i>' . get_string('sourcetype', 'local_ivpdfviewer'),
            $sourcetypes
        );
        $mform->setType('char2', PARAM_ALPHA);
        $mform->setDefault('char2', 'file');

        // PDF upload.
        $filemanageroptions = [
            'maxbytes'       => $PAGE->course->maxbytes,
            'subdirs'        => 0,
            'maxfiles'       => 1,
            'accepted_types' => ['.pdf'],
        ];

        $mform->addElement(
            'filemanager',
            'content',
            '<i class="bi bi-file-pdf iv-mr-2"></i>' . get_string('pdffile', 'local_ivpdfviewer'),
            null,
            $filemanageroptions
        );
        $mform->hideIf('content', 'char2', 'eq', 'url');

        // External URL.
        $mform->addElement(
            'text',
            'iframeurl',
            '<i class="bi bi-globe iv-mr-2"></i>' . get_string('externalurl', 'local_ivpdfviewer'),
            ['placeholder' => 'https://example.com/document.pdf']
        );
        $mform->setType('iframeurl', PARAM_TEXT);
        $mform->hideIf('iframeurl', 'char2', 'eq', 'file');

        // PDF page numbers.
        $mform->addElement(
            'text',
            'char1',
            '<i class="bi bi-book-half iv-mr-2"></i>' . get_string('pagenumbers', 'local_ivpdfviewer'),
            [
                'size' => 100,
            ]
        );
        $mform->setType('char1', PARAM_TEXT);
        $mform->addHelpButton('char1', 'pagenumbers', 'local_ivpdfviewer');

        // Save page progress.
        $group = [];
        $group[] = $mform->createElement(
            'advcheckbox',
            'savepagebefore',
            '',
            get_string('beforecompletion', 'mod_interactivevideo'),
            null,
            [0, 1]
        );
        $group[] = $mform->createElement(
            'advcheckbox',
            'savepageafter',
            '',
            get_string('aftercompletion', 'mod_interactivevideo'),
            null,
            [0, 1]
        );
        $group[] = $mform->createElement(
            'static',
            'savepageprogressdesc',
            '',
            '<span class="text-muted small w-100 d-block">'
                . get_string('savepageprogressdesc', 'local_ivpdfviewer') . '</span>'
        );
        $mform->addGroup($group, 'savepageprogressgroup', get_string('savepageprogress', 'local_ivpdfviewer'), '', false);

        $mform->addElement(
            'advcheckbox',
            'hidetools',
            '',
            get_string('hidetools', 'local_ivpdfviewer'),
            null,
            [0, 1]
        );
        $mform->setDefault('hidetools', 1);
    }

    /**
     * Prepares the PDF data for the form.
     *
     * @param object $data The data object.
     * @param string $component The component name.
     * @return object The prepared data.
     */
    public static function prepare_pdf_data($data, $component) {
        global $CFG;
        require_once($CFG->libdir . '/filelib.php');
        $draftitemid = file_get_submitted_draft_itemid('content');
        file_prepare_draft_area($draftitemid, $data->contextid, $component, 'content', $data->id);
        $data->content = $draftitemid;
        if ($data->char1 == 'null') {
            $data->char1 = '';
        }
        $data->iframeurl = self::normalize_iframeurl($data->iframeurl ?? '');
        if (empty($data->char2) || $data->char2 == 'null') {
            $data->char2 = !empty($data->iframeurl) ? 'url' : 'file';
        }
        return $data;
    }

    /**
     * Saves the PDF data to the database.
     *
     * @param object $fromform The form data.
     * @param string $component The component name.
     */
    public static function save_pdf_data($fromform, $component) {
        global $DB;
        $sourcetype = isset($fromform->char2) ? $fromform->char2 : 'file';
        $table = $component === 'mod_flexbook' ? 'flexbook_items' : 'interactivevideo_items';

        if ($sourcetype === 'file') {
            // Clear URL in DB since source type is file.
            $DB->set_field($table, 'iframeurl', '', ['id' => $fromform->id]);

            if (!empty($fromform->content)) {
                file_save_draft_area_files(
                    $fromform->content,
                    $fromform->contextid,
                    $component,
                    'content',
                    $fromform->id,
                );
            }
        } else {
            // Source type is URL. Clear files from the content area.
            $fs = get_file_storage();
            $fs->delete_area_files($fromform->contextid, $component, 'content', $fromform->id);
        }
    }

    /**
     * Validates the PDF viewer elements.
     *
     * @param array $data The submitted form data.
     * @param array $files The submitted files.
     * @return array Array of errors.
     */
    public static function validate_pdfviewer_elements($data, $files) {
        $errors = [];
        $sourcetype = isset($data['char2']) ? $data['char2'] : 'file';

        if ($sourcetype === 'file') {
            if (empty($data['content'])) {
                $errors['content'] = get_string('required');
            } else {
                $usercontext = \context_user::instance($GLOBALS['USER']->id);
                $fs = get_file_storage();
                $draftfiles = $fs->get_area_files($usercontext->id, 'user', 'draft', $data['content'], 'id', false);
                if (count($draftfiles) == 0) {
                    $errors['content'] = get_string('required');
                }
            }
        } else if ($sourcetype === 'url') {
            $iframeurl = self::normalize_iframeurl($data['iframeurl'] ?? '');
            if (empty($iframeurl)) {
                $errors['iframeurl'] = get_string('required');
            } else if (!preg_match('/^https?:\/\//i', $iframeurl) || !clean_param($iframeurl, PARAM_URL)) {
                $errors['iframeurl'] = get_string('invalidurl', 'local_ivpdfviewer');
            }
        }

        return $errors;
    }

    /**
     * Processes advanced settings for PDF viewer.
     *
     * @param object $data The form data.
     * @param string $jsonadv The existing advanced settings JSON string.
     * @return string The updated advanced settings JSON string.
     */
    public static function process_pdf_advanced_settings($data, $jsonadv) {
        $adv = json_decode($jsonadv, true);
        $adv['savepagebefore'] = $data->savepagebefore;
        $adv['savepageafter'] = $data->savepageafter;
        $adv['hidetools'] = $data->hidetools;
        return json_encode($adv);
    }
}
