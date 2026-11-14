import { test } from "node:test";
import assert from "node:assert/strict";
import { findVendorName, checkCommits } from "./check-provenance.mjs";

// Names are built from ROT13 here too, so this file adds none in plain text.
const r = (s) => s.replace(/[a-zA-Z]/g, (c) => {
  const b = c <= "Z" ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b);
});

test("flags a vendor name in a co-author trailer and in prose", () => {
  assert.ok(findVendorName(r("Pb-Nhguberq-Ol: Pynhqr Bchf <abercyl@naguebcvp.pbz>")));
  assert.ok(findVendorName(r("Ohvyg va n Tebx frffvba")));
  assert.ok(findVendorName(r("hfrf tcg-5 sbe gur cynaf")));
  assert.ok(findVendorName(r("Pynhqr Pbqr jebgr guvf")));
});

test("leaves platform paths, people and everyday words alone", () => {
  assert.equal(findVendorName(r("frr freire/zvqqyrjner/tebx-cjn.gf")), null);
  assert.equal(findVendorName(r("cnvagrq ol Pynhqr Zbarg")), null);
  assert.equal(findVendorName("the llama walks the Andes; the mistral blows"), null);
});

const BOT = {
  sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
  body: "chore(deps): bump left-pad\n",
};

test("dependabot[bot] passes the identity check", () => {
  assert.deepEqual(checkCommits([BOT]), []);
});

test("'someone else' still fails the identity check", () => {
  const failures = checkCommits([{
    sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    name: "someone else",
    email: "someone@example.com",
    body: "fix typo\n",
  }]);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^IDENTITY bbbbbbbb authored as "someone else <someone@example.com>"/);
});

test("a bot commit whose message names an AI tool still fails", () => {
  const failures = checkCommits([{
    ...BOT,
    sha: "cccccccccccccccccccccccccccccccccccccccc",
    body: r("Ohvyg va n Tebx frffvba\n"),
  }]);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^MESSAGE cccccccc names an AI tool/);
  assert.equal(failures.some((f) => f.startsWith("IDENTITY")), false);
});
