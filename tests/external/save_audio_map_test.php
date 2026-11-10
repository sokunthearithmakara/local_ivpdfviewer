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
use local_ivpdfviewer\audio_map;

/**
 * Saving the audio-to-page map from the viewer.
 *
 * @package    local_ivpdfviewer
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
#[\PHPUnit\Framework\Attributes\CoversClass(save_audio_map::class)]
final class save_audio_map_test extends \advanced_testcase {
    /**
     * Build a course with a PDF interaction carrying two audio files.
     *
     * @param string $modname interactivevideo or flexbook
     * @param string $type Item type.
     * @return array [course, instance, context, item]
     */
    private function setup_item(string $modname = 'interactivevideo', string $type = 'pdfviewer'): array {
        $course = $this->getDataGenerator()->create_course();
        $gen = $this->getDataGenerator()->get_plugin_generator('mod_' . $modname);
        $instance = $gen->create_instance(['course' => $course->id]);
        $cm = get_coursemodule_from_instance($modname, $instance->id, 0, false, MUST_EXIST);
        $context = \context_module::instance($cm->id);
        $item = $gen->create_item($instance, ['type' => $type, 'char1' => '1-5']);

        $fs = get_file_storage();
        $record = ['contextid' => $context->id, 'component' => 'mod_' . $modname, 'filearea' => 'itext1',
            'itemid' => $item->id, 'filepath' => '/'];
        $fs->create_file_from_string($record + ['filename' => 'Lesson 01@@intro.mp3'], 'x');
        $fs->create_file_from_string($record + ['filename' => 'outro.mp3'], 'x');

        return [$course, $instance, $context, $item];
    }

    /**
     * Run the service the way the AJAX layer does, including return cleaning.
     *
     * @param array $args
     * @return array
     */
    private function call(array $args): array {
        $result = save_audio_map::execute(
            $args['contextid'],
            $args['itemid'],
            $args['plugin'],
            $args['groups'] ?? [],
            $args['tracks'] ?? []
        );
        return external_api::clean_returnvalue(save_audio_map::execute_returns(), $result);
    }

    /**
     * A teacher saves a map; it is stored, missing files are skipped, and the playlist uses it.
     */
    public function test_teacher_saves_map(): void {
        global $DB;
        $this->resetAfterTest();
        [$course, , $context, $item] = $this->setup_item();
        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'editingteacher'));

        $result = $this->call([
            'contextid' => $context->id,
            'itemid' => $item->id,
            'plugin' => 'interactivevideo',
            'groups' => [['path' => 'Lesson 01', 'page' => 2]],
            'tracks' => [
                ['path' => 'Lesson 01/intro.mp3', 'cues' => [['t' => 45, 'page' => 4], ['t' => 0, 'page' => 3]]],
                ['path' => 'deleted.mp3', 'cues' => [['t' => 0, 'page' => 1]]],
            ],
        ]);

        $this->assertSame(1, $result['skipped']);
        $this->assertSame([['path' => 'Lesson 01', 'page' => 2]], $result['groups']);
        $this->assertEquals([['t' => 0, 'page' => 3], ['t' => 45, 'page' => 4]], $result['tracks'][0]['cues']);

        $stored = audio_map::decode($DB->get_field('interactivevideo_items', 'text1', ['id' => $item->id]));
        $this->assertSame(2, $stored['groups']['Lesson 01']);
        $this->assertArrayNotHasKey('deleted.mp3', $stored['tracks']);

        // An empty submission clears the map.
        $this->call(['contextid' => $context->id, 'itemid' => $item->id, 'plugin' => 'interactivevideo']);
        $this->assertSame('', (string) $DB->get_field('interactivevideo_items', 'text1', ['id' => $item->id]));
    }

    /**
     * The same works in flexbook.
     */
    public function test_flexbook(): void {
        global $DB;
        $this->resetAfterTest();
        if (!\core_component::get_component_directory('mod_flexbook')) {
            $this->markTestSkipped('mod_flexbook is not installed.');
        }
        [$course, , $context, $item] = $this->setup_item('flexbook');
        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'editingteacher'));

        $this->call([
            'contextid' => $context->id,
            'itemid' => $item->id,
            'plugin' => 'flexbook',
            'tracks' => [['path' => 'outro.mp3', 'cues' => [['t' => 0, 'page' => 5]]]],
        ]);

        $stored = audio_map::decode($DB->get_field('flexbook_items', 'text1', ['id' => $item->id]));
        $this->assertSame([['t' => 0.0, 'page' => 5]], $stored['tracks']['outro.mp3']);
    }

    /**
     * The viewer's edit flag follows the same capability as the service.
     */
    public function test_can_edit_flag(): void {
        $this->resetAfterTest();
        [$course, , $context] = $this->setup_item();

        $this->assertSame('mod/interactivevideo:edit', \local_ivpdfviewer\helper::audio_map_capability($context));

        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'editingteacher'));
        $this->assertTrue(\local_ivpdfviewer\helper::can_edit_audio_map($context->id));

        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'student'));
        $this->assertFalse(\local_ivpdfviewer\helper::can_edit_audio_map($context->id));

        $this->assertFalse(\local_ivpdfviewer\helper::can_edit_audio_map(999999999));
    }

    /**
     * A student cannot save a map.
     */
    public function test_student_is_refused(): void {
        $this->resetAfterTest();
        [$course, , $context, $item] = $this->setup_item();
        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'student'));

        $this->expectException(\required_capability_exception::class);
        $this->call(['contextid' => $context->id, 'itemid' => $item->id, 'plugin' => 'interactivevideo']);
    }

    /**
     * A teacher of one activity cannot write to an item of another activity.
     */
    public function test_item_from_other_context_is_refused(): void {
        $this->resetAfterTest();
        [$course, , $context] = $this->setup_item();
        [, , , $otheritem] = $this->setup_item();
        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'editingteacher'));

        $this->expectException(\invalid_parameter_exception::class);
        $this->call(['contextid' => $context->id, 'itemid' => $otheritem->id, 'plugin' => 'interactivevideo']);
    }

    /**
     * Only PDF document items take a map.
     */
    public function test_other_item_type_is_refused(): void {
        $this->resetAfterTest();
        [$course, , $context, $item] = $this->setup_item('interactivevideo', 'richtext');
        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'editingteacher'));

        $this->expectException(\invalid_parameter_exception::class);
        $this->call(['contextid' => $context->id, 'itemid' => $item->id, 'plugin' => 'interactivevideo']);
    }

    /**
     * A page hidden by the Pages setting is refused and nothing is stored.
     */
    public function test_hidden_page_is_refused(): void {
        global $DB;
        $this->resetAfterTest();
        [$course, , $context, $item] = $this->setup_item();
        $this->setUser($this->getDataGenerator()->create_and_enrol($course, 'editingteacher'));

        try {
            $this->call([
                'contextid' => $context->id,
                'itemid' => $item->id,
                'plugin' => 'interactivevideo',
                'groups' => [['path' => 'Lesson 01', 'page' => 6]],
            ]);
            $this->fail('A hidden page was accepted.');
        } catch (\invalid_parameter_exception $e) {
            $this->assertEmpty($DB->get_field('interactivevideo_items', 'text1', ['id' => $item->id]));
        }
    }
}
