import assert from "assert/strict";
import { __testPresetFlow } from "../src/services/brandFoodPresets.js";

const {
  normalizeText,
  canonicalizeText,
  buildPresetSearchTerms,
  getSweetnessLevel,
  resolveDrinkKey,
} = __testPresetFlow;

const hasTerm = (text, expected) => {
  assert.ok(
    buildPresetSearchTerms(text).includes(expected),
    `Expected search terms for "${text}" to include "${expected}". Got: ${buildPresetSearchTerms(text).join(", ")}`
  );
};

assert.equal(normalizeText("กินโค๊กซีโร่"), "โค๊กซีโร่");
assert.equal(canonicalizeText("กินโค๊กซีโร่"), "โค้กซีโร่");
hasTerm("กินโค๊กซีโร่", "โค๊กซีโร่");
hasTerm("กินโค๊กซีโร่", "โค้กซีโร่");
hasTerm("กิน potatocorner cheese", "potato corner cheese");
hasTerm("กิน mega   fries", "mega fries");
hasTerm("กิน mage fries", "mega fries");
hasTerm("โอริโอ้ซองเล็ก", "โอริโอซองเล็ก");

assert.equal(getSweetnessLevel("ชาไทยหวานมาก"), 100);
assert.equal(getSweetnessLevel("ชาไทยหวานปกติ"), 75);
assert.equal(getSweetnessLevel("ชาไทยหวานน้อยมาก"), 25);
assert.equal(getSweetnessLevel("ชาไทยหวานน้อย"), 50);
assert.equal(getSweetnessLevel("ชาไทยหวาน 0%"), 0);
assert.equal(getSweetnessLevel("ชาไทยไม่หวาน"), 0);
assert.equal(getSweetnessLevel("ชาไทย"), null);

assert.equal(resolveDrinkKey("ชาไทยหวานน้อย"), "thai_tea");
assert.equal(resolveDrinkKey("ชาเขียวมัทฉะหวานน้อย"), "green_tea_milk");
assert.equal(resolveDrinkKey("อเมริกาโน่ไม่หวาน"), "americano");
assert.equal(resolveDrinkKey("โค้กซีโร่"), "");

console.log("Preset flow tests passed");
