const STICKER_BUCKET = "Paecal-asset";
const STICKER_FOLDER = "Stickers";

export const PAE_STICKERS = {
  GU_WA_LAEW: "01_gu_wa_laew.png",
  LUE_EK_LAEW: "02_lue_ek_laew.png",
  YA_MA_NIAN: "03_ya_ma_nian.png",
  AO_WAN_NEE_THAM_DEE: "04_ao_wan_nee_tham_dee.png",
  PAE_ANUYAT_WAN_NUENG: "05_pae_anuyat_wan_nueng.png",
  PAE_HEN_NA: "06_pae_hen_na.png",
  WO_MUE_NEE_MI_PHIRUT: "07_wo_mue_nee_mi_phirut.png",
  KHAO_JAI_YU_NA: "08_khao_jai_yu_na.png",
};

const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const resolveStickerBaseUrl = () => {
  const explicitBase = normalizeBaseUrl(process.env.PAECAL_STICKER_BASE_URL || process.env.PAECAL_ASSET_BASE_URL || "");
  if (explicitBase) return explicitBase;

  const supabaseUrl = normalizeBaseUrl(process.env.SUPABASE_URL || "");
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/${STICKER_BUCKET}/${STICKER_FOLDER}`;
};

export const getPaeStickerUrl = (fileName = "") => {
  const baseUrl = resolveStickerBaseUrl();
  const file = String(fileName || "").trim();
  if (!baseUrl || !file) return "";
  return `${baseUrl}/${encodeURIComponent(file)}`;
};

export const getPaeStickerByMood = (mood = "") => {
  const key = String(mood || "").trim().toUpperCase();
  return getPaeStickerUrl(PAE_STICKERS[key] || PAE_STICKERS.KHAO_JAI_YU_NA);
};

export const chooseDailyRecapStickerMood = ({ day = {}, memory = {} } = {}) => {
  // Situation severity wins before pattern flavor.
  // Example: very over target should look like "อย่ามาเนียน", not a casual "แปะเห็นนะ" sweet/fried read.
  if (day.mealCount <= 0) return "KHAO_JAI_YU_NA";
  if (day.isVeryOver || memory.hasHeavyPattern) return "YA_MA_NIAN";
  if (day.isOver) return "LUE_EK_LAEW";
  if (day.isNearLimit) return "PAE_ANUYAT_WAN_NUENG";
  if (memory.hasSweetPattern || memory.hasFriedPattern) return "PAE_HEN_NA";
  if (day.goodProteinDay || memory.hasProteinWin) return "AO_WAN_NEE_THAM_DEE";
  return "GU_WA_LAEW";
};

export const chooseDailyRecapStickerUrl = ({ day = {}, memory = {} } = {}) => getPaeStickerByMood(
  chooseDailyRecapStickerMood({ day, memory })
);
