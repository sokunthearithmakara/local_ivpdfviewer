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
 * Settings for the PDF viewer plugin.
 *
 * @package    local_ivpdfviewer
 * @copyright  2024 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $pluginname = get_string('pluginname', 'local_ivpdfviewer');

    \mod_interactivevideo\local\admin_tree::ensure_contenttype_category($ADMIN);

    $ivsettings = new admin_settingpage('local_ivpdfviewer_settings', $pluginname);
    $ADMIN->add('modivcontenttype', $ivsettings);

    $ivsettings->add(new admin_setting_configtext(
        'local_ivpdfviewer/googlefont',
        get_string('googlefont', 'local_ivpdfviewer'),
        get_string('googlefont_desc', 'local_ivpdfviewer'),
        '',
        PARAM_RAW_TRIMMED
    ));
}
