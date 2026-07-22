// src/lib/pixelforge/review/canonical-hash.test.ts
import { describe, expect, it } from "vitest";
import { TREE_HASH_ALGORITHM, canonicalJson, computeTreeHash, treeHashMatches } from "./canonical-hash";

describe("canonicalJson", () => {
  it("ordena las keys de un objeto recursivamente", () => {
    const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
    const b = { a: 2, c: { y: 2, z: 1 }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("conserva el orden de los arrays", () => {
    const a = { list: [1, 2, 3] };
    const b = { list: [3, 2, 1] };
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  });

  it("ordena las keys dentro de objetos anidados en arrays", () => {
    const a = { list: [{ b: 1, a: 2 }] };
    const b = { list: [{ a: 2, b: 1 }] };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe("computeTreeHash", () => {
  it("antepone el prefijo del algoritmo", () => {
    const hash = computeTreeHash({ a: 1 });
    expect(hash.startsWith(`${TREE_HASH_ALGORITHM}:`)).toBe(true);
  });

  it("produce 64 caracteres hex tras el prefijo", () => {
    const hash = computeTreeHash({ a: 1 });
    const [, hex] = hash.split(":");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinista sin importar el orden de las keys", () => {
    const h1 = computeTreeHash({ b: 1, a: 2 });
    const h2 = computeTreeHash({ a: 2, b: 1 });
    expect(h1).toBe(h2);
  });

  it("un array reordenado produce un hash distinto", () => {
    const h1 = computeTreeHash({ list: [1, 2, 3] });
    const h2 = computeTreeHash({ list: [3, 2, 1] });
    expect(h1).not.toBe(h2);
  });
});

describe("treeHashMatches", () => {
  it("true cuando el hash almacenado coincide con el árbol", () => {
    const tree = { a: 1, b: [1, 2] };
    const stored = computeTreeHash(tree);
    expect(treeHashMatches(tree, stored)).toBe(true);
  });

  it("false ante el hash de otro árbol", () => {
    const stored = computeTreeHash({ a: 1 });
    expect(treeHashMatches({ a: 2 }, stored)).toBe(false);
  });

  it("false ante un string sin el prefijo sha256:", () => {
    const tree = { a: 1 };
    const bareHex = computeTreeHash(tree).split(":")[1]!;
    expect(treeHashMatches(tree, bareHex)).toBe(false);
  });
});
