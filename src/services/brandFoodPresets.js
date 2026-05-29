import axios from "axios";

const normalizeSupabaseUrl = (value = "") => String(value || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1\/?$/, "");

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRAND_PRESET_LOOKUP_ENABLED = String(process.env.BRAND_PRESET_LOOKUP_ENABLED ?? "true").toLowerCase() !== "false";
const BRAND_PRESET_TIMEOUT_MS = Number(process.env.BRAND_PRESET_TIMEOUT_MS || 1200);

const isReady = () => Boolean(BRAND_PRESET_LOOKUP_ENABLED && SUPABASE_URL && SUPABASE_KEY);

const supabase = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY || "",
    Authorization: `Bearer ${SUPABASE_KEY || ""}`,
    "Content-Type": "application/json",
  },
  timeout: BRAND_PRESET_TIMEOUT_MS,
});

const normalizeText = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/^กิน\s*/, "")
  .replace(/\s+/g, " ");

const canonicalizeText = (text = "") => normalizeText(text)
  .replace(/โค๊ก/g, "โค้ก")
  .replace(/ซีโร่/g, "zero")
  .replace(/โอริโอ้/g, "โอริโอ")
  .replace(/potato\s*corner/g, "potatocorner")
  .replace(/mage\s*fries/g, "mega fries")
  .replace(/\s+/g, " ")
  .trim();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const escapeLike = (value = "") => String(value || "").replace(/[%*_]/g, "");

const getSweetnessLevel = (text = "") => {
  const value = normalizeText(text);
  if (/(100\s*%|หวาน\s*100|หวานมาก|เพิ่มหวาน)/i.test(value)) return 100;
  if (/(75\s*%|หวาน\s*75|หวานปกติ|ปกติ)/i.test(value)) return 75;
  if (/(50\s*%|หวาน\s*50|หวานน้อย|ครึ่งหวาน)/i.test(value)) return 50;
  if (/(25\s*%|หวาน\s*25|หวานน้อยมาก)/i.test(value)) return 25;
  if (/(ไม่หวาน|หวาน\s*0|(^|[^\d])0\s*%|no\s*sugar|sugar\s*free)/i.test(value)) return 0;
  return null;
};

const DRINK_KEYS = [
  { key: "thai_tea", pattern: /ชาไทย/ },
  { key: "green_tea_milk", pattern: /ชาเขียว|มัทฉะ|มัจฉะ/ },
  { key: "milk_tea", pattern: /ชานม/ },
  { key: "americano", pattern: /อเมริกาโน่|อเมริกาโน|americano|กาแฟดำ/ },
  { key: "latte", pattern: /ลาเต้|latte/ },
  { key: "cocoa", pattern: /โกโก้|cocoa/ },
  { key: "lemon_tea", pattern: /ชามะนาว/ },
  { key: "orange_juice", pattern: /น้ำส้ม|orange\s*juice/ },
];

const resolveDrinkKey = (text = "") => DRINK_KEYS.find((item) => item.pattern.test(text))?.key || "";

const mapPresetRow = (row = {}, source = "brand_preset") => ({
  menuName: row.menu_name || row.product_name || row.brand || "อาหาร",
  kcal: toNumber(row.kcal, 0),
  carb: toNumber(row.carb, 0),
  protein: toNumber(row.protein, 0),
  fat: toNumber(row.fat, 0),
  sugar: toNumber(row.sugar, 0),
  confidence: row.confidence || "medium",
  estimateMode: source,
  presetKey: row.preset_key || row.drink_key || "",
  brand: row.brand || "",
  servingSize: row.serving_size || "",
  verified: Boolean(row.verified),
});

const findDrinkSweetnessPreset = async (text) => {
  const sweetnessLevel = getSweetnessLevel(text);
  if (sweetnessLevel === null) return null;
  const drinkKey = resolveDrinkKey(text);
  if (!drinkKey) return null;

  const res = await supabase.get("/drink_sweetness_levels", {
    params: {
      drink_key: `eq.${drinkKey}`,
      sweetness_level: `eq.${sweetnessLevel}`,
      select: "drink_key,menu_name,sweetness_level,kcal,carb,protein,fat,sugar,confidence,verified",
      limit: 1,
    },
  });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  if (!row) return null;
  return { ...mapPresetRow(row, "drink_sweetness_preset"), sweetnessLevel };
};

const findBrandPreset = async (text) => {
  const value = normalizeText(text);
  const terms = [...new Set([value, canonicalizeText(value)])].filter((term) => term && term.length >= 2);

  for (const term of terms) {
    const safe = escapeLike(term);
    const res = await supabase.get("/brand_food_presets", {
      params: {
        status: "eq.active",
        or: `(aliases.cs.{"${safe}"},menu_name.ilike.*${safe}*,product_name.ilike.*${safe}*,brand.ilike.*${safe}*)`,
        select: "preset_key,brand,product_name,menu_name,category,serving_size,kcal,carb,protein,fat,sugar,sweetness_level,confidence,verified",
        limit: 5,
      },
    });

    const rows = Array.isArray(res.data) ? res.data : [];
    if (!rows.length) continue;

    const exact = rows.find((row) =>
      canonicalizeText(row.menu_name) === term ||
      canonicalizeText(row.product_name) === term ||
      canonicalizeText(row.brand) === term
    );
    return mapPresetRow(exact || rows[0], "brand_preset");
  }
  return null;
};

export const findFoodPreset = async (text = "") => {
  if (!isReady()) return null;
  const value = normalizeText(text);
  if (!value) return null;

  try {
    return await findDrinkSweetnessPreset(value) || await findBrandPreset(value);
  } catch (err) {
    const code = err?.response?.data?.code || "";
    const message = err?.response?.data?.message || err?.message || "";
    if (code === "42P01" || /relation .* does not exist|Could not find/i.test(message)) {
      console.warn("[PaeCalPreset] skipped; run supabase/007_brand_food_presets.sql first");
      return null;
    }
    console.warn("[PaeCalPreset] lookup failed", err?.response?.data || err?.message || err);
    return null;
  }
};
