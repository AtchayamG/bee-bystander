import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('apps/surface guard against hardcoded claims, checkmarks, and invented numbers', () => {
  const surfaceDir = join(process.cwd(), '..', '..', 'apps', 'surface');
  const srcDir = join(surfaceDir, 'src');
  const indexHtmlPath = join(surfaceDir, 'index.html');

  function getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allSrcFiles = getAllFiles(srcDir);
  const indexHtml = readFileSync(indexHtmlPath, 'utf8');

  it('reads the surface source files (non-empty)', () => {
    assert.ok(allSrcFiles.length > 0, 'No files found in apps/surface/src');
    for (const filePath of allSrcFiles) {
      const content = readFileSync(filePath, 'utf8');
      assert.ok(content.length > 0, `${filePath} is empty`);
    }
    assert.ok(indexHtml.length > 100, 'index.html is suspiciously short or empty');
  });

  // Collect all TS/JS source content stripped of comments
  const tsFiles = allSrcFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  const allCleanTs = tsFiles
    .map((filePath) => {
      const raw = readFileSync(filePath, 'utf8');
      return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    })
    .join('\n');

  it('has no hardcoded checkmark character (✓ or &#10003; or &check;) in UI source', () => {
    for (const filePath of allSrcFiles) {
      const raw = readFileSync(filePath, 'utf8');
      const clean = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.ok(!clean.includes('✓'), `Found literal "✓" in ${filePath}`);
      assert.ok(!clean.includes('&#10003;'), `Found HTML checkmark entity in ${filePath}`);
      assert.ok(!clean.includes('&check;'), `Found HTML checkmark entity in ${filePath}`);
    }
    assert.ok(!indexHtml.includes('✓'), 'Found literal "✓" in index.html');
    assert.ok(!indexHtml.includes('&#10003;'), 'Found HTML checkmark entity in index.html');
    assert.ok(!indexHtml.includes('&check;'), 'Found HTML checkmark entity in index.html');
  });

  it('has no numeric fallback || <number> anywhere', () => {
    const hits = allCleanTs.match(/\|\|\s*'?-?\d[\d.]*/g) ?? [];
    assert.deepEqual(hits, [], `Found numeric || fallbacks: ${hits.join(', ')}`);
  });

  it('has no numeric fallback ?? <number> anywhere', () => {
    const hits = allCleanTs.match(/\?\?\s*'?-?\d[\d.]*/g) ?? [];
    assert.deepEqual(hits, [], `Found numeric ?? fallbacks: ${hits.join(', ')}`);
  });

  it('has no numeric fallback disguised as a ternary (x ? x : <number>)', () => {
    // The || and ?? guards above were passed by
    //   status?.retentionDays ? status.retentionDays : 30
    // which does exactly what they forbid: it substitutes a number the server
    // never sent, and additionally turns a real value of 0 into 30. A guard
    // that only knows two spellings of a mistake is a guard with a hole in it.
    const hits = allCleanTs.match(/\?[^?:;{}\n]{0,80}:\s*-?\d[\d.]*\s*[;,)\n]/g) ?? [];
    assert.deepEqual(
      hits,
      [],
      `Found ternary numeric fallbacks: ${hits.map((h) => h.trim()).join(' | ')}`
    );
  });

  it('does not assert database or protocol state as a literal instead of reading it', () => {
    // Journal mode, foreign-key enforcement and the MCP tool list were all
    // printed as literal sentences in the settings view. Every one happened to
    // be true, which is what makes them dangerous: they would have kept saying
    // so after the underlying thing changed. They now come from
    // GET /api/status.
    const banned = [
      'WAL (Write-Ahead Logging)',
      'bystander_get_transcript,',
      'Exposes 4 verified tools'
    ];
    for (const phrase of banned) {
      assert.ok(
        !allCleanTs.includes(phrase),
        `Surface asserts runtime state as a literal: "${phrase}" - read it from /api/status instead`
      );
    }
    assert.ok(
      allCleanTs.includes('storage?.journalMode'),
      'Journal mode should be read from the status payload'
    );
    assert.ok(
      allCleanTs.includes('mcpTools'),
      'MCP tool names should be read from the status payload'
    );
  });

  it('has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")', () => {
    const hits = allCleanTs.match(/\b\d{1,3}%/g) ?? [];
    assert.deepEqual(hits, [], `Found hardcoded percentage claim: ${hits.join(', ')}`);
  });

  it('renders "not reported" when a field is missing, never a fabricated substitute', () => {
    assert.ok(allCleanTs.includes('not reported'), 'Missing "not reported" fallback mechanism');
  });

  it('binds computed pipeline properties directly from data', () => {
    assert.ok(allCleanTs.includes('data.rawUtteranceCount'));
    assert.ok(allCleanTs.includes('data.redactedUtteranceCount'));
    assert.ok(allCleanTs.includes('audit.totalRedactedChars'));
    assert.ok(allCleanTs.includes('audit.totalRedactedWords'));
    assert.ok(allCleanTs.includes('audit.removals.length'));
  });

  it('labels a signed-in local proxy and preserves a live-empty account without fixtures', () => {
    assert.ok(allCleanTs.includes("conversationMode === 'live' && rawConversations.length === 0"));
    assert.ok(allCleanTs.includes("status?.beeApi.viaProxy ? 'Signed in via local bee proxy'"));
    assert.ok(allCleanTs.includes("conversationsViaProxy ? 'Signed in via local bee proxy'"));
    assert.ok(allCleanTs.includes('Signed in to Bee — no conversations yet.'));
  });
});
