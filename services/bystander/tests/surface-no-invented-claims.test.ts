import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('apps/surface guard against hardcoded claims, checkmarks, and invented numbers', () => {
  const surfaceDir = join(process.cwd(), '..', '..', 'apps', 'surface');
  const mainTsPath = join(surfaceDir, 'src', 'main.ts');
  const indexHtmlPath = join(surfaceDir, 'index.html');

  const mainTs = readFileSync(mainTsPath, 'utf8');
  const indexHtml = readFileSync(indexHtmlPath, 'utf8');

  it('reads the surface source files (non-empty)', () => {
    assert.ok(mainTs.length > 1000, 'main.ts is suspiciously short or empty');
    assert.ok(indexHtml.length > 100, 'index.html is suspiciously short or empty');
  });

  // Strip block comments and single-line comments
  const cleanTs = mainTs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('has no hardcoded checkmark character (✓ or &#10003; or &check;) in UI source', () => {
    assert.ok(!cleanTs.includes('✓'), 'Found literal "✓" in main.ts');
    assert.ok(!cleanTs.includes('&#10003;'), 'Found HTML checkmark entity in main.ts');
    assert.ok(!indexHtml.includes('✓'), 'Found literal "✓" in index.html');
  });

  it('has no numeric fallback || <number> anywhere', () => {
    const hits = cleanTs.match(/\|\|\s*'?-?\d[\d.]*/g) ?? [];
    assert.deepEqual(hits, [], `Found numeric || fallbacks: ${hits.join(', ')}`);
  });

  it('has no numeric fallback ?? <number> anywhere', () => {
    const hits = cleanTs.match(/\?\?\s*'?-?\d[\d.]*/g) ?? [];
    assert.deepEqual(hits, [], `Found numeric ?? fallbacks: ${hits.join(', ')}`);
  });

  it('has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")', () => {
    const hits = cleanTs.match(/\b\d{1,3}%/g) ?? [];
    assert.deepEqual(hits, [], `Found hardcoded percentage claim: ${hits.join(', ')}`);
  });

  it('renders "not reported" when a field is missing, never a fabricated substitute', () => {
    assert.ok(cleanTs.includes('not reported'), 'Missing "not reported" fallback mechanism');
  });

  it('binds computed pipeline properties directly from data', () => {
    assert.ok(cleanTs.includes('data.rawUtteranceCount'));
    assert.ok(cleanTs.includes('data.redactedUtteranceCount'));
    assert.ok(cleanTs.includes('audit.totalRedactedChars'));
    assert.ok(cleanTs.includes('audit.totalRedactedWords'));
    assert.ok(cleanTs.includes('audit.removals.length'));
  });
});
