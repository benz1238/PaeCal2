import assert from "assert/strict";
import { __testPresetFlow } from "../src/services/brandFoodPresets.js";
import { __testFoodLogFlex } from "../src/utils/foodLogFlex.js";

const {
  normalizeText,
  canonicalizeText,
  buildPresetSearchTerms,
  getSweetnessLevel,
  resolveDrinkKey,
} = __testPresetFlow;

const { buildDailyEnergyGauge } = __testFoodLogFlex;

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

const greenGauge = buildDailyEnergyGauge({ total: 1200, target: 2050 });
assert.equal(greenGauge.statusEmoji, "🟢");
assert.equal(greenGauge.fillPercent < 75, true);

const yellowGauge = buildDailyEnergyGauge({ total: 1800, target: 2050 });
assert.equal(yellowGauge.statusEmoji, "🟡");
assert.equal(yellowGauge.fillPercent >= 75, true);

const redGauge = buildDailyEnergyGauge({ total: 2445, target: 2050 });
assert.equal(redGauge.statusEmoji, "🔴");
assert.equal(redGauge.fillPercent, 100);
assert.equal(redGauge.overKcal, 395);

const blizzardGauge = buildDailyEnergyGauge({ total: 300, target: 2050 });
assert.equal(blizzardGauge.statusEmoji, "🟢");
assert.equal(blizzardGauge.leftKcal, 1750);

console.log("Preset flow tests passed");
