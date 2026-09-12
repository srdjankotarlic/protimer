'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'controller.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})/gi)].map(match => [match[1], match[2]]));
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
};

test('Control palette keeps normal text and action labels readable', () => {
  for (const background of ['bg', 'panel', 'panel2', 'input', 'control', 'control-hover']) {
    for (const foreground of ['text', 'dim']) {
      assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, `${foreground} on ${background}`);
    }
  }
  for (const background of ['bg', 'panel', 'panel2', 'input']) {
    assert.ok(contrast(tokens.dim2, tokens[background]) >= 4.5, `secondary text on ${background}`);
  }
  for (const background of ['accent-d', 'selection']) {
    assert.ok(contrast('#ffffff', tokens[background]) >= 4.5, `white action label on ${background}`);
  }
  for (const background of ['panel', 'control']) {
    assert.ok(contrast(tokens['focus-ring'], tokens[background]) >= 3, `focus on ${background}`);
  }
});

test('Polish preserves native controls, explicit focus and motion preferences', () => {
  assert.match(css, /color-scheme:dark/);
  assert.match(css, /button,input,select,textarea\{font-family:inherit/);
  assert.match(css, /:is\(button,summary,input,select,textarea\):focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /button:active\s*\{\s*transform:scale/);
  // Warning flashing is a user-selected live-show signal, not a decorative transition.
  assert.match(css, /\.pv-time\.neg\{animation:pulse/);
});
