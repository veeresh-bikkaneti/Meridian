import { test } from "node:test";
import assert from "node:assert/strict";
import { findVendorName } from "./check-provenance.mjs";

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
