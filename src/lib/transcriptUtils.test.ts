import assert from 'assert';
import { appendChunk } from './transcriptUtils';

function runTests() {
  console.log("Running transcriptUtils tests...");

  // Word boundary
  assert.strictEqual(appendChunk("Hello", "world"), "Hello world");
  assert.strictEqual(appendChunk("Hello ", "world"), "Hello world");
  assert.strictEqual(appendChunk("Hello", " world"), "Hello world");
  assert.strictEqual(appendChunk("Hello  ", "  world"), "Hello world");

  // Punctuation boundary
  assert.strictEqual(appendChunk("Hello", "."), "Hello.");
  assert.strictEqual(appendChunk("Hello ", "."), "Hello.");
  assert.strictEqual(appendChunk("Hello  ", " ."), "Hello.");
  assert.strictEqual(appendChunk("Hello", ", world"), "Hello, world");
  
  // Newline boundary
  assert.strictEqual(appendChunk("Hello\n", "world"), "Hello\nworld");
  assert.strictEqual(appendChunk("Hello", "\nworld"), "Hello\nworld");
  assert.strictEqual(appendChunk("Hello \n ", " world"), "Hello\nworld");
  assert.strictEqual(appendChunk("List:\n* ", "item"), "List:\n* item");

  // Internal punctuation / Markdown regression
  assert.strictEqual(appendChunk("Hello **", "bold**"), "Hello **bold**");
  assert.strictEqual(appendChunk("Hello**", "bold**"), "Hello**bold**");
  assert.strictEqual(appendChunk("[Link", "](url)"), "[Link](url)");
  assert.strictEqual(appendChunk("100", "%"), "100%");
  
  // Empty chunks
  assert.strictEqual(appendChunk("", "Hello "), "Hello ");
  assert.strictEqual(appendChunk("Hello", ""), "Hello");
  assert.strictEqual(appendChunk("Hello", " "), "Hello ");
  assert.strictEqual(appendChunk("Hello ", " "), "Hello ");

  console.log("All tests passed!");
}

runTests();
