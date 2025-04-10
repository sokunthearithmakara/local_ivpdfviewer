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
 * Class main
 *
 * @package    local_ivpdfviewer
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class main extends \ivplugin_richtext\main {
    /**
     * Get the property.
     */
    public function get_property() {
        return [
            'name' => 'pdfviewer',
            'icon' => 'bi bi-file-pdf',
            'title' => get_string('pdfviewercontent', 'local_ivpdfviewer'),
            'amdmodule' => 'local_ivpdfviewer/main',
            'class' => 'local_ivpdfviewer\\main',
            'form' => 'local_ivpdfviewer\\form',
            'hascompletion' => true,
            'hastimestamp' => true,
            'hasreport' => true,
            'description' => get_string('pdfviewerdescription', 'local_ivpdfviewer'),
            'author' => 'tsmakara',
            'authorlink' => 'mailto:sokunthearithmakara@gmail.com',
            'tutorial' => get_string('tutorialurl', 'local_ivpdfviewer'),
        ];
    }

    /**
     * Get the content.
     *
     * @param array $arg The arguments.
     * @return string The content.
     */
    public function get_content($arg) {
        global $CFG;
        $lang = current_language();
        $fs = get_file_storage();
        $files = $fs->get_area_files($arg["contextid"], 'mod_interactivevideo', 'content', $arg["id"], 'id DESC', false);
        $file = reset($files);
        if ($file) {
            $url = \moodle_url::make_pluginfile_url(
                $file->get_contextid(),
                $file->get_component(),
                $file->get_filearea(),
                $file->get_itemid(),
                $file->get_filepath(),
                $file->get_filename(),
            )->out();
            // Encode URL for PDF.js.
            $url = urlencode($url);
            return '<iframe id="iframe" src="' . $CFG->wwwroot .
                '/local/ivpdfviewer/libraries/pdfjs/web/viewer.html?file=' .
                $url . '#locale=' . $lang .
                '" style="width: 100%; height: 100%" frameborder="0" allow="autoplay" class="iv-rounded-0"></iframe>';
        } else {
            return '<div class="alert alert-danger" role="alert">' . get_string('nofile', 'local_ivpdfviewer') . '</div>';
        }
        return $arg;
    }
}
