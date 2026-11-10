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
 * The audio-to-page map stored as JSON in the item's text1 field.
 *
 * Entries are keyed by the logical path of a lesson folder or audio file ("Lesson 01" or
 * "Lesson 01/intro.mp3"), never by file id, so a map survives backup/restore and duplication,
 * which give every stored file a new id. A group maps to one page. A track maps to a list of
 * cues ({t: seconds, page}); a track that only opens a page has a single cue at t = 0.
 *
 * Stored shape:
 * {"version": 1,
 *  "groups": [{"path": "Lesson 01", "page": 4}],
 *  "tracks": [{"path": "Lesson 01/intro.mp3", "cues": [{"t": 0, "page": 4}]}]}
 *
 * @package    local_ivpdfviewer
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class audio_map {
    /** @var int Version of the stored JSON shape. */
    const VERSION = 1;

    /** @var string Separator between folder segments in stored filenames (see helper::flatten_stored_audio_folders). */
    const FLAT_SEPARATOR = '@@';

    /**
     * Logical location of a stored audio file, whether it sits in a real subfolder or was flattened.
     *
     * @param string $filepath The stored file path, e.g. '/' or '/Lesson 01/'.
     * @param string $filename The stored file name, e.g. 'intro.mp3' or 'Lesson 01@@intro.mp3'.
     * @return array{group: string, file: string, key: string} group is '' for files at the root.
     */
    public static function locate(string $filepath, string $filename): array {
        $segments = [];
        if ($filepath !== '/') {
            $segments = explode('/', trim($filepath, '/'));
        } else if (strpos($filename, self::FLAT_SEPARATOR) !== false) {
            $segments = explode(self::FLAT_SEPARATOR, $filename);
            $filename = (string) array_pop($segments);
        }
        $segments = array_values(array_filter(array_map('trim', $segments), 'strlen'));
        $group = implode('/', $segments);

        return [
            'group' => $group,
            'file' => $filename,
            'key' => $group === '' ? $filename : $group . '/' . $filename,
        ];
    }

    /**
     * Reads a stored map. Anything that is not a valid map reads as an empty one.
     *
     * @param string|null $raw The text1 value.
     * @return array{groups: array<string, int>, tracks: array<string, array>} Pages by group path, cues by track path.
     */
    public static function decode(?string $raw): array {
        $map = ['groups' => [], 'tracks' => []];
        $data = json_decode((string) $raw, true);
        if (!is_array($data) || ($data['version'] ?? null) !== self::VERSION) {
            return $map;
        }

        foreach ($data['groups'] ?? [] as $group) {
            $page = (int) ($group['page'] ?? 0);
            if (isset($group['path']) && is_string($group['path']) && $page > 0) {
                $map['groups'][$group['path']] = $page;
            }
        }
        foreach ($data['tracks'] ?? [] as $track) {
            if (!isset($track['path']) || !is_string($track['path'])) {
                continue;
            }
            $cues = self::normalize_cues(is_array($track['cues'] ?? null) ? $track['cues'] : []);
            if (!empty($cues)) {
                $map['tracks'][$track['path']] = $cues;
            }
        }
        return $map;
    }

    /**
     * Serialises a map for storage, in a stable order.
     *
     * @param array $map As returned by decode() or normalize().
     * @return string JSON, or '' when the map is empty.
     */
    public static function encode(array $map): string {
        $groups = $map['groups'] ?? [];
        $tracks = $map['tracks'] ?? [];
        if (empty($groups) && empty($tracks)) {
            return '';
        }
        ksort($groups, SORT_STRING);
        ksort($tracks, SORT_STRING);

        $data = ['version' => self::VERSION, 'groups' => [], 'tracks' => []];
        foreach ($groups as $path => $page) {
            $data['groups'][] = ['path' => (string) $path, 'page' => $page];
        }
        foreach ($tracks as $path => $cues) {
            $data['tracks'][] = ['path' => (string) $path, 'cues' => $cues];
        }
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Builds a map from submitted entries, keeping only the ones that point at existing files.
     *
     * Entries for paths that no longer exist are dropped and counted, so a stale editor cannot
     * store references to deleted files. A page outside the allowed pages is a client error.
     *
     * @param array $groups List of ['path' => string, 'page' => int].
     * @param array $tracks List of ['path' => string, 'cues' => [['t' => float, 'page' => int], ...]].
     * @param string[] $grouppaths Group paths that exist in the file area.
     * @param string[] $trackpaths Track paths that exist in the file area.
     * @param array|null $allowedpages Page ranges from parse_page_ranges(), or null when every page is shown.
     * @return array{map: array, skipped: int}
     * @throws \invalid_parameter_exception When a page is not a shown page.
     */
    public static function normalize(
        array $groups,
        array $tracks,
        array $grouppaths,
        array $trackpaths,
        ?array $allowedpages
    ): array {
        $grouppaths = array_flip($grouppaths);
        $trackpaths = array_flip($trackpaths);
        $map = ['groups' => [], 'tracks' => []];
        $skipped = 0;

        foreach ($groups as $group) {
            $path = (string) ($group['path'] ?? '');
            $page = (int) ($group['page'] ?? 0);
            self::require_page($page, $allowedpages);
            if (!isset($grouppaths[$path])) {
                $skipped++;
                continue;
            }
            $map['groups'][$path] = $page;
        }

        foreach ($tracks as $track) {
            $path = (string) ($track['path'] ?? '');
            $cues = self::normalize_cues($track['cues'] ?? []);
            foreach ($cues as $cue) {
                self::require_page($cue['page'], $allowedpages);
            }
            if (!isset($trackpaths[$path])) {
                $skipped++;
                continue;
            }
            if (!empty($cues)) {
                $map['tracks'][$path] = $cues;
            }
        }

        return ['map' => $map, 'skipped' => $skipped];
    }

    /**
     * Sorts cues by time, keeps the last cue for a repeated time and drops invalid ones.
     *
     * @param array $cues List of ['t' => float, 'page' => int].
     * @return array List of ['t' => float, 'page' => int].
     */
    public static function normalize_cues(array $cues): array {
        $bytime = [];
        foreach ($cues as $cue) {
            if (!is_array($cue)) {
                continue;
            }
            $t = (float) ($cue['t'] ?? 0);
            $page = (int) ($cue['page'] ?? 0);
            if (!is_finite($t) || $t < 0 || $page < 1) {
                continue;
            }
            $t = round($t, 2);
            $bytime[(string) $t] = ['t' => $t, 'page' => $page];
        }
        usort($bytime, fn($a, $b) => $a['t'] <=> $b['t']);
        return array_values($bytime);
    }

    /**
     * Parses the item's Pages setting (char1, e.g. "1-3,10") into ranges.
     *
     * Kept as ranges rather than a page list so a value like "1-99999999" costs nothing.
     *
     * @param string|null $pages The Pages setting.
     * @return array|null List of [start, end] pairs, or null when every page is shown.
     */
    public static function parse_page_ranges(?string $pages): ?array {
        $ranges = [];
        foreach (explode(',', (string) $pages) as $part) {
            $part = trim($part);
            if (preg_match('/^(\d+)\s*-\s*(\d+)$/', $part, $m)) {
                $ranges[] = [(int) $m[1], (int) $m[2]];
            } else if (preg_match('/^\d+$/', $part)) {
                $ranges[] = [(int) $part, (int) $part];
            }
        }
        return empty($ranges) ? null : $ranges;
    }

    /**
     * Whether a page can be mapped, given the item's shown pages.
     *
     * @param int $page 1-based page number.
     * @param array|null $allowedpages From parse_page_ranges().
     * @return bool
     */
    public static function is_page_allowed(int $page, ?array $allowedpages): bool {
        if ($page < 1) {
            return false;
        }
        if ($allowedpages === null) {
            return true;
        }
        foreach ($allowedpages as [$start, $end]) {
            if ($page >= $start && $page <= $end) {
                return true;
            }
        }
        return false;
    }

    /**
     * Throws when a page cannot be mapped.
     *
     * @param int $page
     * @param array|null $allowedpages
     * @return void
     * @throws \invalid_parameter_exception
     */
    private static function require_page(int $page, ?array $allowedpages): void {
        if (!self::is_page_allowed($page, $allowedpages)) {
            throw new \invalid_parameter_exception('Page ' . $page . ' is not one of the pages shown.');
        }
    }
}
