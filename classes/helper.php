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

        // Audio files (subfolders = lessons/groups, files = tracks).
        $audiofilemanageroptions = [
            'maxbytes'       => $PAGE->course->maxbytes,
            'subdirs'        => 1,
            'maxfiles'       => EDITOR_UNLIMITED_FILES,
            // Only formats browsers can play; the player is the browser's own audio element.
            'accepted_types' => ['html_audio'],
        ];
        $mform->addElement(
            'filemanager',
            'itext1',
            '<i class="bi bi-headphones iv-mr-2"></i>' . get_string('audiofiles', 'local_ivpdfviewer'),
            null,
            $audiofilemanageroptions
        );
        $mform->addHelpButton('itext1', 'audiofiles', 'local_ivpdfviewer');

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
        $draftitemid = !empty($data->content) && is_numeric($data->content)
            ? (int) $data->content
            : file_get_submitted_draft_itemid('content');
        file_prepare_draft_area($draftitemid, $data->contextid, $component, 'content', $data->id);
        $data->content = $draftitemid;

        $submittedaudiodraft = !empty($data->itext1) && is_numeric($data->itext1)
            ? (int) $data->itext1
            : file_get_submitted_draft_itemid('itext1');
        $isinitialprepare = empty($submittedaudiodraft);
        $audiodraftitemid = $submittedaudiodraft;
        file_prepare_draft_area(
            $audiodraftitemid,
            $data->contextid,
            $component,
            'itext1',
            $data->id,
            ['subdirs' => 1]
        );
        if ($isinitialprepare) {
            self::unpack_draft_audio_folders($audiodraftitemid);
        }
        $data->itext1 = $audiodraftitemid;

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

        // Save audio files into itext1 and flatten subfolder paths so .ivz/.fbz archives preserve groups without collisions.
        if (!empty($fromform->itext1)) {
            file_save_draft_area_files(
                $fromform->itext1,
                $fromform->contextid,
                $component,
                'itext1',
                $fromform->id,
                ['subdirs' => 1]
            );
            self::flatten_stored_audio_folders((int) $fromform->contextid, $component, (int) $fromform->id);
        }
    }

    /**
     * Flattens subfolder audio files in the stored itext1 area into root '/' with '@@'-delimited filenames.
     *
     * @param int $contextid
     * @param string $component
     * @param int $itemid
     * @return void
     */
    public static function flatten_stored_audio_folders(int $contextid, string $component, int $itemid): void {
        $fs = get_file_storage();
        $files = $fs->get_area_files($contextid, $component, 'itext1', $itemid, 'id ASC', true);
        $subdirs = [];

        foreach ($files as $file) {
            if ($file->is_directory()) {
                if ($file->get_filepath() !== '/') {
                    $subdirs[] = $file;
                }
                continue;
            }
            if ($file->get_filepath() !== '/') {
                $prefix = str_replace('/', '@@', trim($file->get_filepath(), '/'));
                $flatname = clean_param($prefix . '@@' . $file->get_filename(), PARAM_FILE);
                $existing = $fs->get_file($contextid, $component, 'itext1', $itemid, '/', $flatname);
                if ($existing && $existing->get_id() !== $file->get_id()) {
                    $existing->delete();
                }
                $file->rename('/', $flatname);
            }
        }

        foreach ($subdirs as $dir) {
            $dir->delete();
        }
    }

    /**
     * Unpacks '@@'-delimited root audio files in the user's draft area back into draft subfolders for editing.
     *
     * @param int $draftitemid
     * @return void
     */
    public static function unpack_draft_audio_folders(int $draftitemid): void {
        global $USER;
        if (empty($draftitemid) || empty($USER->id)) {
            return;
        }
        $usercontext = \context_user::instance($USER->id);
        $fs = get_file_storage();
        $files = $fs->get_area_files($usercontext->id, 'user', 'draft', $draftitemid, 'id ASC', false);

        foreach ($files as $file) {
            $filename = $file->get_filename();
            if ($file->get_filepath() === '/' && strpos($filename, '@@') !== false) {
                $parts = explode('@@', $filename);
                $actualfilename = array_pop($parts);
                $parts = array_values(array_filter(array_map('trim', $parts), 'strlen'));
                if (empty($parts) || $actualfilename === '') {
                    continue;
                }

                $accum = '/';
                foreach ($parts as $segment) {
                    $accum .= $segment . '/';
                    $fs->create_directory($usercontext->id, 'user', 'draft', $draftitemid, $accum);
                }

                $existing = $fs->get_file($usercontext->id, 'user', 'draft', $draftitemid, $accum, $actualfilename);
                if (!$existing) {
                    $file->rename($accum, $actualfilename);
                }
            }
        }
    }

    /**
     * Parses the configured Google Font site setting (`{font-family}|Google Font URL`).
     *
     * @return array{family: string, url: string}|null
     */
    public static function get_google_font_config(): ?array {
        $raw = (string) get_config('local_ivpdfviewer', 'googlefont');
        if (trim($raw) === '' || strpos($raw, '|') === false) {
            return null;
        }
        [$rawfamily, $url] = explode('|', $raw, 2);
        $url = clean_param(trim($url), PARAM_URL);
        if ($url === '') {
            return null;
        }

        $rawfamily = trim($rawfamily);
        if ($rawfamily === '') {
            return null;
        }

        $genericfamilies = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
        $parts = explode(',', $rawfamily);
        $cleanparts = [];
        foreach ($parts as $part) {
            $name = trim($part, " \t\n\r\0\x0B'\"");
            if ($name === '') {
                continue;
            }
            if (in_array(strtolower($name), $genericfamilies, true)) {
                $cleanparts[] = strtolower($name);
            } else {
                $cleanparts[] = '"' . addslashes($name) . '"';
            }
        }

        if (empty($cleanparts)) {
            return null;
        }

        $hasgeneric = false;
        foreach ($cleanparts as $part) {
            if (in_array($part, $genericfamilies, true)) {
                $hasgeneric = true;
                break;
            }
        }
        if (!$hasgeneric) {
            $cleanparts[] = 'sans-serif';
        }

        return [
            'family' => implode(', ', $cleanparts),
            'url' => $url,
        ];
    }

    /**
     * The capability needed to edit an item's audio map in a context.
     *
     * @param \context $context The item's context.
     * @return string
     */
    public static function audio_map_capability(\context $context): string {
        if ($context->contextlevel == CONTEXT_MODULE) {
            $cm = get_coursemodule_from_id('', $context->instanceid, 0, false, MUST_EXIST);
            if ($cm->modname === 'interactivevideo' || $cm->modname === 'flexbook') {
                return 'mod/' . $cm->modname . ':edit';
            }
        }
        return 'moodle/course:manageactivities';
    }

    /**
     * Whether the current user may edit audio maps in a context.
     *
     * Only decides what the viewer shows; the save service checks again.
     *
     * @param int $contextid
     * @return bool
     */
    public static function can_edit_audio_map(int $contextid): bool {
        $context = \context::instance_by_id($contextid, IGNORE_MISSING);
        if (!$context) {
            return false;
        }
        return has_capability(self::audio_map_capability($context), $context);
    }

    /**
     * What the viewer's map editor needs to save: where the item lives and its labels.
     *
     * @param int $contextid
     * @param int $itemid
     * @param string $component mod_interactivevideo or mod_flexbook.
     * @return array
     */
    public static function get_audio_map_editor_config(int $contextid, int $itemid, string $component): array {
        return [
            'contextid' => $contextid,
            'itemid' => $itemid,
            'plugin' => $component === 'mod_flexbook' ? 'flexbook' : 'interactivevideo',
            'strings' => [
                'editpagelinks' => get_string('editpagelinks', 'local_ivpdfviewer'),
                'linktopage' => get_string('linktopage', 'local_ivpdfviewer', '{page}'),
                'removepagelink' => get_string('removepagelink', 'local_ivpdfviewer'),
                'unsavedpagelinks' => get_string('unsavedpagelinks', 'local_ivpdfviewer'),
                'pagelinkssaved' => get_string('pagelinkssaved', 'local_ivpdfviewer'),
                'pagelinksskipped' => get_string('pagelinksskipped', 'local_ivpdfviewer', '{count}'),
                'savechanges' => get_string('savechanges'),
                'cancel' => get_string('cancel'),
            ],
        ];
    }

    /**
     * Lists the audio files of an item with their logical lesson folder and map key.
     *
     * @param int $contextid
     * @param string $component
     * @param int $itemid
     * @return array List of ['file' => \stored_file, 'group' => string, 'filename' => string, 'key' => string].
     */
    public static function get_audio_files(int $contextid, string $component, int $itemid): array {
        $fs = get_file_storage();
        $files = $fs->get_area_files($contextid, $component, 'itext1', $itemid, 'id ASC', false);
        $located = [];
        foreach ($files as $file) {
            $location = audio_map::locate($file->get_filepath(), $file->get_filename());
            $located[] = [
                'file' => $file,
                'group' => $location['group'],
                'filename' => $location['file'],
                'key' => $location['key'],
            ];
        }
        return $located;
    }

    /**
     * Builds the structured audio playlist payload for an interaction item.
     *
     * @param int $contextid
     * @param string $component
     * @param int $itemid
     * @param string|null $rawmap The stored audio map (text1), see audio_map.
     * @return array
     */
    public static function get_audio_playlist(int $contextid, string $component, int $itemid, ?string $rawmap = ''): array {
        $files = self::get_audio_files($contextid, $component, $itemid);
        if (empty($files)) {
            return [];
        }

        $map = audio_map::decode($rawmap);
        $groupsmap = [];
        foreach ($files as $entry) {
            $file = $entry['file'];
            $title = pathinfo($entry['filename'], PATHINFO_FILENAME);
            $cues = $map['tracks'][$entry['key']] ?? [];
            $groupsmap[$entry['group']][] = [
                'key' => $entry['key'],
                'title' => $title === '' ? $entry['filename'] : $title,
                'url' => \moodle_url::make_pluginfile_url(
                    $file->get_contextid(),
                    $file->get_component(),
                    $file->get_filearea(),
                    $file->get_itemid(),
                    $file->get_filepath(),
                    $file->get_filename()
                )->out(false),
                'page' => $cues[0]['page'] ?? null,
                'cues' => $cues,
            ];
        }

        // Lesson folders in natural order, then loose files at the root as a last group.
        $roottracks = $groupsmap[''] ?? [];
        unset($groupsmap['']);
        uksort($groupsmap, 'strnatcasecmp');
        $bytitle = fn(array $a, array $b): int => strnatcasecmp($a['title'], $b['title']);

        $groups = [];
        foreach ($groupsmap as $path => $tracks) {
            usort($tracks, $bytitle);
            $groups[] = [
                'key' => (string) $path,
                'title' => str_replace('/', ' / ', (string) $path),
                'page' => $map['groups'][$path] ?? null,
                'tracks' => $tracks,
            ];
        }
        if (!empty($roottracks)) {
            usort($roottracks, $bytitle);
            $groups[] = [
                'key' => '',
                'title' => get_string('audiofiles', 'local_ivpdfviewer'),
                'page' => $map['groups'][''] ?? null,
                'ungrouped' => empty($groupsmap),
                'tracks' => $roottracks,
            ];
        }

        return [
            'groups' => $groups,
            'strings' => [
                'contents' => get_string('contents', 'local_ivpdfviewer'),
                'hidecontents' => get_string('hidecontents', 'local_ivpdfviewer'),
                'showcontents' => get_string('showcontents', 'local_ivpdfviewer'),
                'paused' => get_string('paused', 'local_ivpdfviewer'),
                'playing' => get_string('playing', 'local_ivpdfviewer'),
                'playpause' => get_string('playpause', 'local_ivpdfviewer'),
                'gotopage' => get_string('gotopage', 'local_ivpdfviewer', '{page}'),
                'playbackspeed' => get_string('playbackspeed', 'local_ivpdfviewer'),
                'repeat' => get_string('repeat', 'local_ivpdfviewer'),
                'lesson' => get_string('lesson', 'local_ivpdfviewer'),
                'lessons' => get_string('lessons', 'local_ivpdfviewer', '{count}'),
                'track' => get_string('track', 'local_ivpdfviewer'),
                'tracks' => get_string('tracks', 'local_ivpdfviewer', '{count}'),
                'trackxofy' => get_string('trackxofy', 'local_ivpdfviewer', (object) [
                    'current' => '{current}',
                    'total' => '{total}',
                ]),
                'pageshort' => get_string('pageshort', 'local_ivpdfviewer', '{page}'),
                'notlinked' => get_string('notlinked', 'local_ivpdfviewer'),
                'pagenotshown' => get_string('pagenotshown', 'local_ivpdfviewer', '{page}'),
            ],
        ];
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
