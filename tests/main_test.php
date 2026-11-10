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
 * The viewer markup and the audio payload it carries.
 *
 * @package    local_ivpdfviewer
 * @category   test
 * @copyright  2026 Sokunthearith Makara <sokunthearithmakara@gmail.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
#[\PHPUnit\Framework\Attributes\CoversMethod(main::class, 'get_content')]
final class main_test extends \advanced_testcase {
    /**
     * Render an interaction with a PDF, one audio file and a stored map.
     *
     * @param string $role Role of the viewing user.
     * @return array The decoded data-audio payload.
     */
    private function render_payload(string $role): array {
        global $DB;
        $course = $this->getDataGenerator()->create_course();
        $gen = $this->getDataGenerator()->get_plugin_generator('mod_interactivevideo');
        $instance = $gen->create_instance(['course' => $course->id]);
        $cm = get_coursemodule_from_instance('interactivevideo', $instance->id, 0, false, MUST_EXIST);
        $context = \context_module::instance($cm->id);
        $item = $gen->create_item($instance, ['type' => 'pdfviewer']);

        $fs = get_file_storage();
        $record = ['contextid' => $context->id, 'component' => 'mod_interactivevideo', 'itemid' => $item->id, 'filepath' => '/'];
        $fs->create_file_from_string($record + ['filearea' => 'content', 'filename' => 'doc.pdf'], '%PDF-1.4');
        $fs->create_file_from_string($record + ['filearea' => 'itext1', 'filename' => 'Lesson 01@@intro.mp3'], 'x');

        $DB->set_field('interactivevideo_items', 'text1', audio_map::encode([
            'groups' => ['Lesson 01' => 3],
            'tracks' => [],
        ]), ['id' => $item->id]);

        $this->setUser($this->getDataGenerator()->create_and_enrol($course, $role));

        // The browser's copy of the item is stale: it still has no map.
        $html = (new main())->get_content([
            'id' => $item->id,
            'contextid' => $context->id,
            'plugin' => 'interactivevideo',
            'text1' => '',
        ]);
        $this->assertMatchesRegularExpression('/data-audio="([^"]+)"/', $html);
        preg_match('/data-audio="([^"]+)"/', $html, $m);
        return json_decode(htmlspecialchars_decode($m[1], ENT_QUOTES), true);
    }

    /**
     * Editors get the stored map and what they need to save changes.
     */
    public function test_editor_payload(): void {
        $this->resetAfterTest();
        $payload = $this->render_payload('editingteacher');

        $this->assertSame(3, $payload['groups'][0]['page']);
        $this->assertTrue($payload['canedit']);
        $this->assertSame('interactivevideo', $payload['editor']['plugin']);
        $this->assertArrayHasKey('linktopage', $payload['editor']['strings']);
    }

    /**
     * Learners get the stored map but no editor details.
     */
    public function test_learner_payload(): void {
        $this->resetAfterTest();
        $payload = $this->render_payload('student');

        $this->assertSame(3, $payload['groups'][0]['page']);
        $this->assertFalse($payload['canedit']);
        $this->assertArrayNotHasKey('editor', $payload);
    }
}
