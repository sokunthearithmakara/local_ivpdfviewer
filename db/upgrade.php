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
 * Upgrade script for pdfviewer.
 *
 * @package    local_ivpdfviewer
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Upgrade callback for local_ivpdfviewer.
 *
 * @param int $oldversion The currently installed version.
 * @return bool
 */
function xmldb_local_ivpdfviewer_upgrade($oldversion) {
    if ($oldversion < 2026052600) {
        if (get_config('mod_flexbook', 'version')) {
            $config = array_filter(explode(',', get_config('mod_flexbook', 'enablecontenttypes') ?: ''));
            $config[] = 'local_ivpdfviewer';
            set_config('enablecontenttypes', implode(',', array_unique($config)), 'mod_flexbook');
        }

        upgrade_plugin_savepoint(true, 2026052600, 'local', 'ivpdfviewer');
    }

    return true;
}
