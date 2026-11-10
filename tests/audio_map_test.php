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
 * The audio-to-page map and the playlist built from it.
 *
 * @package    local_ivpdfviewer
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
#[\PHPUnit\Framework\Attributes\CoversClass(audio_map::class)]
#[\PHPUnit\Framework\Attributes\CoversMethod(helper::class, 'get_audio_playlist')]
final class audio_map_test extends \advanced_testcase {
    /**
     * Real subfolders and flattened names give the same key, at any depth.
     */
    public function test_locate_matches_real_and_flattened_folders(): void {
        $this->assertSame(
            ['group' => '', 'file' => 'intro.mp3', 'key' => 'intro.mp3'],
            audio_map::locate('/', 'intro.mp3')
        );
        $this->assertSame(
            audio_map::locate('/Lesson 01/Part A/', 'intro.mp3'),
            audio_map::locate('/', 'Lesson 01@@Part A@@intro.mp3')
        );
        $this->assertSame('Lesson 01/Part A/intro.mp3', audio_map::locate('/Lesson 01/Part A/', 'intro.mp3')['key']);
    }

    /**
     * A map survives encode then decode, including Khmer paths, in a stable order.
     */
    public function test_encode_decode_round_trip(): void {
        $map = [
            'groups' => ['មេរៀន ២' => 9, 'Lesson 01' => 4],
            'tracks' => ['Lesson 01/intro.mp3' => [['t' => 0.0, 'page' => 4], ['t' => 92.5, 'page' => 5]]],
        ];

        $raw = audio_map::encode($map);
        $decoded = audio_map::decode($raw);

        $this->assertSame(4, $decoded['groups']['Lesson 01']);
        $this->assertSame(9, $decoded['groups']['មេរៀន ២']);
        $this->assertSame($map['tracks'], $decoded['tracks']);
        $this->assertSame($raw, audio_map::encode($decoded));
        $this->assertStringContainsString('មេរៀន', $raw);
    }

    /**
     * Empty, legacy free text and unknown versions all read as an empty map.
     */
    public function test_decode_rejects_anything_else(): void {
        $empty = ['groups' => [], 'tracks' => []];
        $this->assertSame($empty, audio_map::decode(null));
        $this->assertSame($empty, audio_map::decode(''));
        $this->assertSame($empty, audio_map::decode("Lesson 01: 4\nLesson 02: 12"));
        $this->assertSame($empty, audio_map::decode('{"version":2,"groups":[{"path":"A","page":1}]}'));
        $this->assertSame('', audio_map::encode($empty));
    }

    /**
     * Cues come back sorted, with one cue per time and invalid ones dropped.
     */
    public function test_normalize_cues(): void {
        $cues = audio_map::normalize_cues([
            ['t' => 30, 'page' => 6],
            ['t' => 0, 'page' => 4],
            ['t' => 30.001, 'page' => 7],
            ['t' => -1, 'page' => 2],
            ['t' => 10, 'page' => 0],
            'junk',
        ]);
        $this->assertSame([['t' => 0.0, 'page' => 4], ['t' => 30.0, 'page' => 7]], $cues);
    }

    /**
     * The Pages setting limits which pages can be mapped, without expanding huge ranges.
     */
    public function test_page_ranges(): void {
        $this->assertNull(audio_map::parse_page_ranges(''));
        $this->assertNull(audio_map::parse_page_ranges(null));

        $ranges = audio_map::parse_page_ranges('1-3, 10 ,x, 20-99999999');
        $this->assertSame([[1, 3], [10, 10], [20, 99999999]], $ranges);
        $this->assertTrue(audio_map::is_page_allowed(2, $ranges));
        $this->assertTrue(audio_map::is_page_allowed(5000000, $ranges));
        $this->assertFalse(audio_map::is_page_allowed(4, $ranges));
        $this->assertFalse(audio_map::is_page_allowed(0, null));
        $this->assertTrue(audio_map::is_page_allowed(500, null));
    }

    /**
     * Entries for missing files are skipped; a page that is not shown is refused.
     */
    public function test_normalize(): void {
        $result = audio_map::normalize(
            [['path' => 'Lesson 01', 'page' => 2], ['path' => 'Gone', 'page' => 3]],
            [
                ['path' => 'Lesson 01/a.mp3', 'cues' => [['t' => 0, 'page' => 3]]],
                ['path' => 'Lesson 01/b.mp3', 'cues' => []],
                ['path' => 'Gone/a.mp3', 'cues' => [['t' => 0, 'page' => 3]]],
            ],
            ['Lesson 01'],
            ['Lesson 01/a.mp3', 'Lesson 01/b.mp3'],
            [[1, 3]]
        );
        $this->assertSame(2, $result['skipped']);
        $this->assertSame(['Lesson 01' => 2], $result['map']['groups']);
        $this->assertSame(['Lesson 01/a.mp3' => [['t' => 0.0, 'page' => 3]]], $result['map']['tracks']);

        $this->expectException(\invalid_parameter_exception::class);
        audio_map::normalize([['path' => 'Lesson 01', 'page' => 7]], [], ['Lesson 01'], [], [[1, 3]]);
    }

    /**
     * The playlist groups nested and flattened files by lesson and applies the map to both.
     */
    public function test_playlist_applies_map(): void {
        $this->resetAfterTest();
        $context = \context_system::instance();
        $fs = get_file_storage();
        $record = ['contextid' => $context->id, 'component' => 'mod_interactivevideo', 'filearea' => 'itext1', 'itemid' => 7];
        $fs->create_file_from_string($record + ['filepath' => '/', 'filename' => 'Lesson 10@@Part A@@b.mp3'], 'x');
        $fs->create_file_from_string($record + ['filepath' => '/Lesson 2/', 'filename' => 'a.mp3'], 'x');
        $fs->create_file_from_string($record + ['filepath' => '/', 'filename' => 'loose.mp3'], 'x');

        $raw = audio_map::encode([
            'groups' => ['Lesson 10/Part A' => 12, '' => 1],
            'tracks' => ['Lesson 10/Part A/b.mp3' => [['t' => 0.0, 'page' => 13], ['t' => 60.0, 'page' => 14]]],
        ]);
        $playlist = helper::get_audio_playlist($context->id, 'mod_interactivevideo', 7, $raw);
        $groups = $playlist['groups'];

        // Natural order: "Lesson 2" before "Lesson 10"; loose files last.
        $this->assertSame(['Lesson 2', 'Lesson 10/Part A', ''], array_column($groups, 'key'));
        $this->assertSame('Lesson 10 / Part A', $groups[1]['title']);
        $this->assertNull($groups[0]['page']);
        $this->assertSame(12, $groups[1]['page']);
        $this->assertSame(1, $groups[2]['page']);
        $this->assertFalse($groups[2]['ungrouped']);

        $track = $groups[1]['tracks'][0];
        $this->assertSame('Lesson 10/Part A/b.mp3', $track['key']);
        $this->assertSame('b', $track['title']);
        $this->assertSame(13, $track['page']);
        $this->assertCount(2, $track['cues']);
        $this->assertNull($groups[0]['tracks'][0]['page']);
    }

    /**
     * No audio files means no playlist.
     */
    public function test_playlist_empty_without_files(): void {
        $this->resetAfterTest();
        $this->assertSame([], helper::get_audio_playlist(\context_system::instance()->id, 'mod_interactivevideo', 7, ''));
    }
}
