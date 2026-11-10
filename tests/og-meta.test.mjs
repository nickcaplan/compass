import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Link-preview contract: the served HTML head carries the Open Graph and
// Twitter tags, and the social card they point at ships in public/.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const expected = [
  ['og:type', 'website', 'property'],
  ['og:site_name', 'Compass', 'property'],
  ['og:title', 'Compass - Your media plan, in minutes', 'property'],
  ['og:url', 'https://compass-demo.websitesbynick.co.uk/', 'property'],
  ['og:image', 'https://compass-demo.websitesbynick.co.uk/compass-social.png', 'property'],
  ['og:image:width', '1200', 'property'],
  ['og:image:height', '630', 'property'],
  ['twitter:card', 'summary_large_image', 'name'],
];

test('link-preview meta tags are present and exact', () => {
  for (const [key, content, attr] of expected) {
    const tag = new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, m => '\\' + m)}" content="([^"]*)"`);
    const match = html.match(tag);
    assert.ok(match, `missing meta ${attr}="${key}"`);
    assert.equal(match[1], content, `meta ${key} content changed`);
  }
  const desc = html.match(/<meta property="og:description" content="([^"]*)"/);
  assert.ok(desc && desc[1].length >= 50, 'og:description missing or too short to be useful');
});

test('the social card image exists at the advertised size', () => {
  const png = readFileSync(new URL('../public/compass-social.png', import.meta.url));
  assert.equal(png.readUInt32BE(0), 0x89504e47, 'not a PNG');
  assert.equal(png.readUInt32BE(16), 1200, 'width must match og:image:width');
  assert.equal(png.readUInt32BE(20), 630, 'height must match og:image:height');
});
