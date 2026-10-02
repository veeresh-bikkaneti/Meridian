#!/usr/bin/env node
/**
 * facts-wikidata-extract.test.mjs — unit tests for Worker B's Wikidata extractor.
 * All fixtures are canned SPARQL JSON; NO network calls are made in tests.
 *
 * Run: node --test scripts/facts-wikidata-extract.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildBatchQuery,
  parseSparqlRows,
  chunkArray,
  coverageStats,
  appendRecords,
  readRecords,
  readProcessedQids,
  extract,
  loadQids,
  parseCliArgs,
  TARGET_PROPERTIES,
  DEFAULT_QIDS,
} from './facts-wikidata-extract.mjs';

const RETRIEVED_AT = '2026-10-02T00:00:00.000Z';
const ENT = (q) => `http://www.wikidata.org/entity/${q}`;
const STMT = (s) => `http://www.wikidata.org/entity/statement/${s}`;
const REF = (r) => `http://www.wikidata.org/reference/${r}`;

// ---------------------------------------------------------------- fixtures

/** Canned bindings covering: P138 w/ ref, P571 literal date w/o ref, P547 w/ qualifiers. */
function fixtureBindings() {
  return [
    // NYC named after Duke of York — two rows: one carries the reference
    {
      item: { type: 'uri', value: ENT('Q60') },
      property: { type: 'literal', value: 'P138' },
      statement: { type: 'uri', value: STMT('Q60-p138a') },
      value: { type: 'uri', value: ENT('Q131156') },
      valueLabel: { type: 'literal', value: 'Duke of York' },
      reference: { type: 'uri', value: REF('r1') },
    },
    {
      item: { type: 'uri', value: ENT('Q60') },
      property: { type: 'literal', value: 'P138' },
      statement: { type: 'uri', value: STMT('Q60-p138a') },
      value: { type: 'uri', value: ENT('Q131156') },
      valueLabel: { type: 'literal', value: 'Duke of York' },
    },
    // NYC inception 1624 — literal date, no reference anywhere
    {
      item: { type: 'uri', value: ENT('Q60') },
      property: { type: 'literal', value: 'P571' },
      statement: { type: 'uri', value: STMT('Q60-p571a') },
      value: { type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#dateTime', value: '1624-01-01T00:00:00Z' },
      valueLabel: { type: 'literal', value: '1624' },
    },
    // Louisville KY commemorates ... two qualifier rows, one with reference
    {
      item: { type: 'uri', value: ENT('Q43668') },
      property: { type: 'literal', value: 'P547' },
      statement: { type: 'uri', value: STMT('Q43668-p547a') },
      value: { type: 'uri', value: ENT('Q1164') },
      valueLabel: { type: 'literal', value: 'Louis XVI' },
      qualifierProp: { type: 'literal', value: 'P585' },
      qualifierValue: { type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#dateTime', value: '1780-01-01T00:00:00Z' },
      qualifierValueLabel: { type: 'literal', value: '1780' },
    },
    {
      item: { type: 'uri', value: ENT('Q43668') },
      property: { type: 'literal', value: 'P547' },
      statement: { type: 'uri', value: STMT('Q43668-p547a') },
      value: { type: 'uri', value: ENT('Q1164') },
      valueLabel: { type: 'literal', value: 'Louis XVI' },
      qualifierProp: { type: 'literal', value: 'P518' },
      qualifierValue: { type: 'uri', value: ENT('Q12345') },
      qualifierValueLabel: { type: 'literal', value: 'naming' },
      reference: { type: 'uri', value: REF('r2') },
    },
    // junk rows: unknown property + missing item must be ignored
    {
      item: { type: 'uri', value: ENT('Q60') },
      property: { type: 'literal', value: 'P9999' },
      statement: { type: 'uri', value: STMT('junk') },
      value: { type: 'literal', value: 'x' },
    },
    {
      property: { type: 'literal', value: 'P138' },
      statement: { type: 'uri', value: STMT('junk2') },
      value: { type: 'literal', value: 'y' },
    },
  ];
}

/** Minimal stub fetch returning a fixed SPARQL JSON payload. */
function stubFetch(bindings, seen = []) {
  return async (url, opts) => {
    seen.push(opts.body);
    return {
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => ({ results: { bindings } }),
    };
  };
}

// ---------------------------------------------------------------- query

test('buildBatchQuery embeds QIDs and the three properties', () => {
  const q = buildBatchQuery(['Q60', 'Q2931901']);
  assert.ok(q.includes('wd:Q60'), 'Q60 in VALUES');
  assert.ok(q.includes('wd:Q2931901'), 'Louisville GA in VALUES');
  for (const p of Object.keys(TARGET_PROPERTIES)) {
    assert.ok(q.includes(`p:${p}`), `${p} predicate present`);
    assert.ok(q.includes(`ps:${p}`), `${p} value predicate present`);
  }
  assert.ok(q.includes('prov:wasDerivedFrom'), 'reference probe present');
  assert.ok(q.includes('User-Agent') === false, 'no headers in query text');
});

test('DEFAULT_QIDS has 50 valid QIDs incl. NYC and Louisville GA', () => {
  assert.equal(DEFAULT_QIDS.length, 50);
  assert.ok(DEFAULT_QIDS.includes('Q60'));
  assert.ok(DEFAULT_QIDS.includes('Q2931901'));
  for (const q of DEFAULT_QIDS) assert.match(q, /^Q\d+$/);
});

// ---------------------------------------------------------------- batching

test('chunkArray splits into <=50 batches', () => {
  const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);
  const chunks = chunkArray(ids, 50);
  assert.deepEqual(chunks.map((c) => c.length), [50, 50, 20]);
  assert.deepEqual(chunkArray(['Q1'], 50), [['Q1']]);
  assert.deepEqual(chunkArray([], 50), []);
});

// ---------------------------------------------------------------- parsing

test('parseSparqlRows maps statements -> records with reference detection', () => {
  const recs = parseSparqlRows(fixtureBindings(), RETRIEVED_AT);
  assert.equal(recs.length, 3, 'junk rows ignored, per-statement collapse');

  const named = recs.find((r) => r.property === 'P138');
  assert.equal(named.qid, 'Q60');
  assert.equal(named.valueLabel, 'Duke of York');
  assert.equal(named.valueQid, 'Q131156');
  assert.equal(named.hasReference, true, 'one row carried a reference -> true');
  assert.equal(named.geonamesId, null);
  assert.equal(named.retrievedAt, RETRIEVED_AT);

  const inception = recs.find((r) => r.property === 'P571');
  assert.equal(inception.valueQid, null, 'literal date has no valueQid');
  assert.equal(inception.rawValue, '1624-01-01T00:00:00Z', 'raw value preserved, never relabelled');
  assert.equal(inception.valueLabel, '1624');
  assert.equal(inception.hasReference, false, 'no reference rows -> false');

  const commem = recs.find((r) => r.property === 'P547');
  assert.equal(commem.qid, 'Q43668');
  assert.equal(commem.hasReference, true);
  assert.equal(commem.qualifiers.length, 2, 'qualifiers unioned across rows');
  const qp = commem.qualifiers.map((q) => q.property).sort();
  assert.deepEqual(qp, ['P518', 'P585']);
  const appliesTo = commem.qualifiers.find((q) => q.property === 'P518');
  assert.equal(appliesTo.value, 'naming');
  assert.equal(appliesTo.valueQid, 'Q12345');
});

test('parseSparqlRows dedupes identical qualifier rows', () => {
  const b = fixtureBindings().filter((r) => r.property?.value === 'P547');
  const dup = [...b, ...b];
  const recs = parseSparqlRows(dup, RETRIEVED_AT);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].qualifiers.length, 2);
});

// ---------------------------------------------------------------- resume

test('resume: extract skips QIDs already in output, appends only new', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wd-facts-'));
  const out = join(dir, 'wikidata-facts.jsonl');
  try {
    appendRecords([{
      qid: 'Q60', geonamesId: null, property: 'P138', valueLabel: 'Duke of York',
      valueQid: 'Q131156', rawValue: ENT('Q131156'), qualifiers: [],
      hasReference: true, retrievedAt: RETRIEVED_AT,
    }], out);
    assert.deepEqual([...readProcessedQids(out)], ['Q60']);

    const seen = [];
    const bindings = fixtureBindings().filter((r) => r.item?.value === ENT('Q43668'));
    const { processed, skipped, records } = await extract(['Q60', 'Q43668'], {
      fetchFn: stubFetch(bindings, seen),
      sleepMs: 0,
      outputPath: out,
    });
    assert.deepEqual(skipped, ['Q60']);
    assert.deepEqual(processed, ['Q43668']);
    assert.equal(seen.length, 1, 'only one batch fetched');
    assert.ok(seen[0].includes('Q43668'), 'batch covers the new QID');
    assert.ok(!decodeURIComponent(seen[0]).includes('wd:Q60 '), 'done QID not refetched');
    assert.equal(records.length, 1);
    const lines = readFileSync(out, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2, 'Q60 line preserved, Q43668 appended');
    assert.equal(JSON.parse(lines[0]).qid, 'Q60');
    assert.equal(JSON.parse(lines[1]).qid, 'Q43668');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendRecords/readRecords round-trip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wd-facts-'));
  const out = join(dir, 'f.jsonl');
  try {
    assert.equal(appendRecords([], out), 0, 'empty append is a no-op');
    const rec = { qid: 'Q61', property: 'P571', hasReference: false };
    assert.equal(appendRecords([rec], out), 1);
    assert.deepEqual(readRecords(out), [rec]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- coverage

test('coverageStats: per-property counts and reference %', () => {
  const recs = parseSparqlRows(fixtureBindings(), RETRIEVED_AT);
  const s = coverageStats(recs);
  assert.equal(s.qidsProcessed, 2);
  assert.equal(s.statements, 3);
  assert.deepEqual(s.perProperty.P138, { total: 1, withRef: 1 });
  assert.deepEqual(s.perProperty.P571, { total: 1, withRef: 0 });
  assert.deepEqual(s.perProperty.P547, { total: 1, withRef: 1 });
  assert.equal(s.pctWithReferences, 67);
});

test('coverageStats on empty records', () => {
  const s = coverageStats([]);
  assert.equal(s.qidsProcessed, 0);
  assert.equal(s.statements, 0);
  assert.equal(s.pctWithReferences, 0);
});

// ---------------------------------------------------------------- cli parsing

test('loadQids validates, uppercases, dedupes', () => {
  assert.deepEqual(loadQids({ qids: ['q60', 'Q60', 'Q61', 'bogus', 'Q', 'Q61'] }), ['Q60', 'Q61']);
  assert.deepEqual(loadQids({}), DEFAULT_QIDS);
});

test('parseCliArgs handles command and flags', () => {
  assert.deepEqual(parseCliArgs(['coverage']).command, 'coverage');
  const a = parseCliArgs(['extract', '--qids=Q60,Q61', '--limit=5']);
  assert.equal(a.command, 'extract');
  assert.deepEqual(a.qids, ['Q60', 'Q61']);
  assert.equal(a.limit, 5);
  const b = parseCliArgs(['--qids', 'Q1,Q2', '--qids-file', 'x.txt']);
  assert.deepEqual(b.qids, ['Q1', 'Q2']);
  assert.equal(b.qidsFile, 'x.txt');
});
