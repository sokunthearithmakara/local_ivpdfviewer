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

namespace local_ivpdfviewer\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use local_ivpdfviewer\audio_map;
use local_ivpdfviewer\helper;

/**
 * Save the audio-to-page map of a PDF document interaction.
 *
 * The submitted map replaces the stored one. Entries for files that no longer exist are
 * dropped and counted in "skipped"; the saved map is returned so the editor can re-render.
 *
 * @package    local_ivpdfviewer
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class save_audio_map extends external_api {
    /**
     * Parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters() {
        return new external_function_parameters([
            'contextid' => new external_value(PARAM_INT, 'The context ID', VALUE_REQUIRED),
            'itemid' => new external_value(PARAM_INT, 'The interaction item ID', VALUE_REQUIRED),
            'plugin' => new external_value(PARAM_ALPHA, 'interactivevideo or flexbook', VALUE_REQUIRED),
            'groups' => self::groups_structure(),
            'tracks' => self::tracks_structure(),
        ]);
    }

    /**
     * Save the map.
     *
     * @param int $contextid
     * @param int $itemid
     * @param string $plugin
     * @param array $groups
     * @param array $tracks
     * @return array
     */
    public static function execute($contextid, $itemid, $plugin, $groups, $tracks) {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'contextid' => $contextid,
            'itemid' => $itemid,
            'plugin' => $plugin,
            'groups' => $groups,
            'tracks' => $tracks,
        ]);

        $context = \context::instance_by_id($params['contextid'], MUST_EXIST);
        self::validate_context($context);

        if (!in_array($params['plugin'], ['interactivevideo', 'flexbook'], true)) {
            throw new \invalid_parameter_exception('Invalid plugin.');
        }

        if ($context->contextlevel === CONTEXT_MODULE) {
            $cm = get_coursemodule_from_id('', $context->instanceid, 0, false, MUST_EXIST);
            if ($cm->modname !== $params['plugin']) {
                throw new \invalid_parameter_exception('Plugin does not match the module context.');
            }
        }
        require_capability(helper::audio_map_capability($context), $context);

        $component = 'mod_' . $params['plugin'];
        $table = $params['plugin'] === 'flexbook' ? 'flexbook_items' : 'interactivevideo_items';
        $item = $DB->get_record($table, ['id' => $params['itemid']], 'id, cmid, annotationid, contextid, type, char1');
        $contextmatches = $item && (
            (int) ($item->contextid ?? 0) === (int) $params['contextid']
            || ($context->contextlevel === CONTEXT_MODULE && (int) $item->cmid === (int) $context->instanceid)
        );
        if (!$contextmatches) {
            throw new \invalid_parameter_exception('Item does not belong to the supplied context.');
        }
        if ($item->type !== 'pdfviewer') {
            throw new \invalid_parameter_exception('Item is not a PDF document.');
        }

        $grouppaths = [];
        $trackpaths = [];
        foreach (helper::get_audio_files((int) $item->contextid, $component, (int) $item->id) as $entry) {
            $grouppaths[$entry['group']] = $entry['group'];
            $trackpaths[] = $entry['key'];
        }

        $result = audio_map::normalize(
            $params['groups'],
            $params['tracks'],
            array_values($grouppaths),
            $trackpaths,
            audio_map::parse_page_ranges($item->char1)
        );

        $DB->update_record($table, (object) [
            'id' => $item->id,
            'text1' => audio_map::encode($result['map']),
            'timemodified' => time(),
        ]);

        // Item lists are cached per instance in interactive video and per course module in flexbook.
        if ($params['plugin'] === 'flexbook') {
            \cache::make('mod_flexbook', 'fb_items')->delete($item->cmid);
        } else {
            \cache::make('mod_interactivevideo', 'iv_items_by_cmid')->delete($item->annotationid);
        }

        $savedgroups = [];
        foreach ($result['map']['groups'] as $path => $page) {
            $savedgroups[] = ['path' => (string) $path, 'page' => $page];
        }
        $savedtracks = [];
        foreach ($result['map']['tracks'] as $path => $cues) {
            $savedtracks[] = ['path' => (string) $path, 'cues' => $cues];
        }

        return [
            'skipped' => $result['skipped'],
            'groups' => $savedgroups,
            'tracks' => $savedtracks,
        ];
    }

    /**
     * Returns.
     *
     * @return external_single_structure
     */
    public static function execute_returns() {
        return new external_single_structure([
            'skipped' => new external_value(PARAM_INT, 'Entries dropped because their file no longer exists'),
            'groups' => self::groups_structure(),
            'tracks' => self::tracks_structure(),
        ]);
    }

    /**
     * Lesson folder entries.
     *
     * @return external_multiple_structure
     */
    private static function groups_structure(): external_multiple_structure {
        return new external_multiple_structure(
            new external_single_structure([
                'path' => new external_value(PARAM_RAW, 'Lesson folder path, empty for files at the root'),
                'page' => new external_value(PARAM_INT, '1-based PDF page'),
            ]),
            'Lesson folder pages',
            VALUE_DEFAULT,
            []
        );
    }

    /**
     * Track entries.
     *
     * @return external_multiple_structure
     */
    private static function tracks_structure(): external_multiple_structure {
        return new external_multiple_structure(
            new external_single_structure([
                'path' => new external_value(PARAM_RAW, 'Track path, e.g. "Lesson 01/intro.mp3"'),
                'cues' => new external_multiple_structure(
                    new external_single_structure([
                        't' => new external_value(PARAM_FLOAT, 'Seconds from the start of the track'),
                        'page' => new external_value(PARAM_INT, '1-based PDF page'),
                    ])
                ),
            ]),
            'Track page cues',
            VALUE_DEFAULT,
            []
        );
    }
}
