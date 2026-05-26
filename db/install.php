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

/**
 * Install script for pdfviewer
 *
 * Documentation: {@link https://moodledev.io/docs/guides/upgrade}
 *
 * @package    local_ivpdfviewer
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Executed on installation of pdfviewer
 *
 * @return bool
 */
function xmldb_local_ivpdfviewer_install() {
    $config = array_filter(explode(',', get_config('mod_interactivevideo', 'enablecontenttypes') ?: ''));
    $config[] = 'local_ivpdfviewer';
    set_config('enablecontenttypes', implode(',', array_unique($config)), 'mod_interactivevideo');

    if (get_config('mod_flexbook', 'version')) {
        $config = array_filter(explode(',', get_config('mod_flexbook', 'enablecontenttypes') ?: ''));
        $config[] = 'local_ivpdfviewer';
        set_config('enablecontenttypes', implode(',', array_unique($config)), 'mod_flexbook');
    }

    return true;
}
