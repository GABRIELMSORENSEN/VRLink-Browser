const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldBlock, directMediaUrl } = require('../src/rules');

test('blocks known ad and tracking hosts', () => {
  assert.equal(shouldBlock('https://www.google-analytics.com/g/collect'), true);
  assert.equal(shouldBlock('https://cdn.example.com/app.js'), false);
});
test('only accepts direct HTTP media URLs', () => {
  assert.equal(directMediaUrl('https://media.example/video.mp4?token=ok'), true);
  assert.equal(directMediaUrl('https://media.example/video.m3u8'), true);
  assert.equal(directMediaUrl('blob:https://site.example/abc'), false);
  assert.equal(directMediaUrl('https://site.example/watch?id=1'), false);
});
