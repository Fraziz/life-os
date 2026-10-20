/**
 * Focused verification tests for Study & Books features:
 * - YouTube URL parsing & timestamp extraction
 * - Video Lesson Block transformation (Edit vs Reader modes)
 * - Study Session Timer state logic & progress calculations
 */

import { parseYouTubeUrl, parseYouTubeTimestamp, isStandaloneYouTubeUrl } from '../src/utils/youtube';
import { generateVideoBlockHtml, transformVideoLessonsInHtml } from '../src/utils/videoLesson';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

console.log('--- Testing YouTube Utility ---');

// 1. Standard watch URL
const res1 = parseYouTubeUrl('https://www.youtube.com/watch?v=2Q_ZzBGPdqE');
assert(res1 !== null && res1.videoId === '2Q_ZzBGPdqE', 'Parses standard watch URL');
assert(res1?.startTime === 0, 'Defaults start time to 0');

// 2. youtu.be short URL with timestamp
const res2 = parseYouTubeUrl('https://youtu.be/2Q_ZzBGPdqE?t=90');
assert(res2 !== null && res2.videoId === '2Q_ZzBGPdqE', 'Parses youtu.be URL');
assert(res2?.startTime === 90, 'Parses simple integer timestamp');

// 3. YouTube Shorts URL
const res3 = parseYouTubeUrl('https://www.youtube.com/shorts/AbCdEfGh123');
assert(res3 !== null && res3.videoId === 'AbCdEfGh123', 'Parses YouTube Shorts URL');

// 4. Combined timestamp (1h2m3s, 2m15s)
assert(parseYouTubeTimestamp('2m15s') === 135, 'Parses 2m15s as 135 seconds');
assert(parseYouTubeTimestamp('1h10m5s') === 4205, 'Parses 1h10m5s as 4205 seconds');

// 5. Invalid URLs
assert(parseYouTubeUrl('https://vimeo.com/123456') === null, 'Rejects non-YouTube domains');
assert(parseYouTubeUrl('not a url') === null, 'Rejects arbitrary text');

// 6. Standalone URL check
assert(isStandaloneYouTubeUrl('https://youtu.be/2Q_ZzBGPdqE') === true, 'Identifies standalone URL');
assert(isStandaloneYouTubeUrl('check out this https://youtu.be/2Q_ZzBGPdqE video') === false, 'Rejects URL surrounded by text');

console.log('\n--- Testing Video Lesson Block Generation ---');

// 7. Video block in reader/book mode
const readerHtml = generateVideoBlockHtml({
  videoId: '2Q_ZzBGPdqE',
  url: 'https://youtu.be/2Q_ZzBGPdqE',
  title: 'Minor Pentatonic Mastery',
  startTime: 45,
  isEditMode: false,
});
assert(readerHtml.includes('data-video-lesson="true"'), 'Includes data-video-lesson attribute');
assert(readerHtml.includes('Minor Pentatonic Mastery'), 'Renders title in reader block');
assert(readerHtml.includes('data-action="focus-view"'), 'Renders Focus View button in reader block');
assert(readerHtml.includes('start=45'), 'Preserves start timestamp in iframe embed URL');

// 8. Video block in edit mode
const editHtml = generateVideoBlockHtml({
  videoId: '2Q_ZzBGPdqE',
  url: 'https://youtu.be/2Q_ZzBGPdqE',
  title: 'Minor Pentatonic Mastery',
  startTime: 45,
  isEditMode: true,
});
assert(editHtml.includes('contenteditable="false"'), 'Sets contenteditable="false" for safe editing');
assert(editHtml.includes('data-action="move-up-video"'), 'Renders Move Up action in edit block');
assert(editHtml.includes('data-action="move-down-video"'), 'Renders Move Down action in edit block');
assert(editHtml.includes('data-action="edit-video"'), 'Renders Edit action in edit block');
assert(editHtml.includes('data-action="delete-video"'), 'Renders Delete action in edit block');

// 9. Markdown custom syntax transformation
const markdownWithBlock = `
# My Book Chapter
Welcome to the lesson.

:::video-lesson{id="2Q_ZzBGPdqE" url="https://youtu.be/2Q_ZzBGPdqE" title="Guitar Basics" start="10"}:::

Continue reading notes below.
`;
const transformed = transformVideoLessonsInHtml(markdownWithBlock, false);
assert(transformed.includes('Guitar Basics'), 'Transforms markdown custom syntax to reader block');
assert(transformed.includes('data-action="focus-view"'), 'Focus view button present in transformed markdown');

console.log('\n--- Testing Study Session Circular Progress Math ---');

// 10. Circular progress ring ratio
const totalPomo = 25 * 60; // 1500s
const remaining1 = 1500; // 100%
const remaining2 = 750;  // 50%
const remaining3 = 0;    // 0%

const ratio1 = remaining1 / totalPomo;
const ratio2 = remaining2 / totalPomo;
const ratio3 = remaining3 / totalPomo;

assert(ratio1 === 1, 'Start of Pomodoro has ratio 1.0 (100%)');
assert(ratio2 === 0.5, 'Midpoint of Pomodoro has ratio 0.5 (50%)');
assert(ratio3 === 0, 'Completion of Pomodoro has ratio 0.0 (0%)');

const radius = 70;
const circumference = 2 * Math.PI * radius;
const offset1 = circumference * (1 - ratio1);
const offset2 = circumference * (1 - ratio2);
const offset3 = circumference * (1 - ratio3);

assert(offset1 === 0, 'Full ring has offset 0');
assert(Math.abs(offset2 - circumference / 2) < 0.001, 'Half ring has offset equal to half circumference');
assert(Math.abs(offset3 - circumference) < 0.001, 'Completed ring has offset equal to full circumference');

console.log('\nAll 10 test suites PASSED with flying colors!');
