import { pushTexts, replyText, getLineImageBase64 } from "../services/line.js";
import { postToSheet } from "../services/sheet.js";
import { refreshSummaryCacheFromSheetResponse } from "../utils/summaryCache.js";
import { getCachedSession, mergeCachedSession, setCachedSession } from "../utils/sessionCache.js";
import { estimateFoodFromImage } from "../services/openai.js";
import { DEFAULT_CALORIE_TARGET, safeNumber } from "../utils/helpers.js";
import { buildProgressBar } from "../utils/advice.js";
import { renderNoFoodDetectedReply } from "../utils/personality.js";

const nowMs = () => Date.now();

const logTiming = (scope, step, startedAt, extra = "") => {
  const ms = Date.now() - startedAt;
  console.log(`[PaeCalTiming] ${scope}:${step} ${ms}ms${extra ? ` ${extra}` : ""}`);
  return ms;
};

const resolveFastTitle = (session) => {
  const data = session?.data || {};
  return String(data.title || data.name || "ลื้อ").trim() || "ลื้อ";
};

const normalizeText = (value) => String(value || "").trim();

const resolveCachedTodayCalories = (session) => {
  return safeNumber(
    session?.todayCalories ?? session?.totalToday ?? session?.data?.todayCalories ?? session?.data?.totalToday,
    0
  );
};

const DRINK_IMAGE_PATTERN = /(โค้ก|โค๊ก|โคคา|โคล่า|coke|cola|pepsi|เป๊ปซี่|น้ำอัดลม|สไปรท์|แฟนต้า|ชานม|ชาไทย|ชาเขียว|มัทฉะ|กาแฟ|โกโก้|นม|น้ำหวาน|หวานเย็น|น้ำแดง|น้ำเขียว|เครื่องดื่ม|แก้วน้ำ|กระป๋อง|ขวด|moccona|มอคโคน่า|nescafe|เนสกาแฟ|birdy|เบอร์ดี้|milo|ไมโล|ovaltine|โอวัลติน)/i;
const NON_DRINK_MAIN_SUBJECT_PATTERN = /(แมว|หมา|สุนัข|ไก่|นก|เอกสาร|จอคอม|หน้าจอ|รถ|วิว)/i;
const PACKAGED_PRODUCT_PATTERN = /(กระปุก|ขวด|กระป๋อง|แก้ว|cup|can|bottle|jar|pack|packet|ซอง|กล่อง)/i;
const READY_TO_DRINK_PATTERN = /(พร้อมดื่ม|ready\s*to\s*drink|iced|เย็น|แก้ว|cup|ขวด|bottle|กระป๋อง|can|ถือแก้ว|ถือขวด|ถือกระป๋อง)/i;

const detectPackagedDrinkProfile = (combined = "") => {
  const text = normalizeText(combined).toLowerCase();
  const isZero = /(zero|ซีโร่|ไม่มีน้ำตาล|0\s*%|sugar\s*free|no\s*sugar)/i.test(text);
  const isThreeInOne = /(3\s*in\s*1|3\s*[-]?\s*1|ทรีอินวัน|สามอินวัน|กาแฟ\s*ซอง|ซอง|sachet|packet|พร้อมครีม|ครีมเทียม|น้ำตาล)/i.test(text);
  const isJarOrInstant = /(กระปุก|jar|instant|สำเร็จรูป|freeze\s*dried|ผงกาแฟ|กาแฟผง|selection|gold|red\s*cup)/i.test(text);
  const isReadyToDrink = /(พร้อมดื่ม|ready\s*to\s*drink|iced|เย็น|แก้ว|cup|ขวด|bottle|กระป๋อง|can|ถือแก้ว|ถือขวด|ถือกระป๋อง)/i.test(text);
  const isBlackCoffee = /(black|americano|อเมริกาโน่|อเมริกาโน|กาแฟดำ|ไม่ใส่น้ำตาล|ไม่หวาน|no\s*sugar)/i.test(text);

  const coffeeNote = (brand) => isThreeInOne
    ? `อันนี้ดูเป็น${brand}แบบซอง/ทรีอินวันนะ 👀 แปะนับคร่าว ๆ ต่อ 1 ซองให้ก่อน`
    : isReadyToDrink
      ? `อันนี้ดูเป็น${brand}พร้อมดื่มนะ 👀 แปะนับคร่าว ๆ ต่อ 1 กระป๋อง/ขวดให้ก่อน`
      : `อันนี้ดูเป็น${brand}แบบกาแฟผงนะ 👀 ถ้าชงดำ ๆ แคลไม่แรง แต่ถ้าเติมนม/น้ำตาลค่อยบวกเพิ่ม`;

  const instantCoffeeProfile = (brand) => {
    if (isThreeInOne) {
      return { menuName: brand, kcal: 90, carb: 14, protein: 1, fat: 3, note: coffeeNote(brand) };
    }

    if (isReadyToDrink) {
      return { menuName: brand, kcal: 120, carb: 18, protein: 2, fat: 3, note: coffeeNote(brand) };
    }

    if (isBlackCoffee || isJarOrInstant) {
      return { menuName: brand, kcal: 15, carb: 2, protein: 1, fat: 0, note: coffeeNote(brand) };
    }

    return { menuName: brand, kcal: 60, carb: 8, protein: 1, fat: 1, note: coffeeNote(brand) };
  };

  if (/(moccona|มอคโคน่า)/i.test(text)) return instantCoffeeProfile("กาแฟมอคโคน่า");
  if (/(nescafe|เนสกาแฟ)/i.test(text)) return instantCoffeeProfile("กาแฟเนสกาแฟ");

  if (/(birdy|เบอร์ดี้)/i.test(text)) {
    if (isZero || isBlackCoffee) {
      return { menuName: "กาแฟเบอร์ดี้", kcal: 15, carb: 2, protein: 1, fat: 0, note: "อันนี้ดูเป็นกาแฟเบอร์ดี้สูตรเบา/ดำ ๆ นะ 👀" };
    }
    return { menuName: "กาแฟเบอร์ดี้", kcal: 110, carb: 18, protein: 2, fat: 3, note: "อันนี้ดูเป็นกาแฟเบอร์ดี้พร้อมดื่มนะ 👀" };
  }

  if (/(coke|coca|โค้ก|โค๊ก|โคคา|โคล่า)/i.test(text)) {
    if (isZero) {
      return { menuName: "โค้กซีโร่", kcal: 0, carb: 0, protein: 0, fat: 0, note: "อันนี้โค้กซีโร่นะ แคลแทบไม่มี แปะให้ผ่านแบบเบา ๆ 👀" };
    }
    return { menuName: "โค้ก", kcal: 140, carb: 35, protein: 0, fat: 0, note: "อันนี้โค้กนะ 👀 แปะนับเป็น 1 ขวด/กระป๋องให้ก่อน" };
  }

  if (/(pepsi|เป๊ปซี่)/i.test(text)) {
    if (isZero) {
      return { menuName: "เป๊ปซี่แมกซ์/ไม่มีน้ำตาล", kcal: 0, carb: 0, protein: 0, fat: 0, note: "อันนี้ดูเป็นเป๊ปซี่สูตรไม่มีน้ำตาลนะ 👀" };
    }
    return { menuName: "เป๊ปซี่", kcal: 140, carb: 35, protein: 0, fat: 0, note: "อันนี้เป๊ปซี่นะ 👀 แปะนับเป็น 1 ขวด/กระป๋องให้ก่อน" };
  }

  if (/(milo|ไมโล)/i.test(text)) {
    const kcal = isReadyToDrink ? 170 : 110;
    return { menuName: "ไมโล", kcal, carb: isReadyToDrink ? 28 : 18, protein: 5, fat: 3, note: "อันนี้ดูเป็นไมโลนะ 👀 ถ้าชงนม/หวานเพิ่ม แคลจะขยับขึ้นอีก" };
  }

  if (/(ovaltine|โอวัลติน)/i.test(text)) {
    const kcal = isReadyToDrink ? 180 : 120;
    return { menuName: "โอวัลติน", kcal, carb: isReadyToDrink ? 30 : 20, protein: 4, fat: 3, note: "อันนี้ดูเป็นโอวัลตินนะ 👀 ถ้าชงนม/หวานเพิ่ม แคลจะขยับขึ้นอีก" };
  }

  return null;
};

const inferDrinkFromImage = ({ imageSubject, imageCaption, gptData }) => {
  const subject = normalizeText(imageSubject);
  const caption = normalizeText(imageCaption);
  const brandName = normalizeText(gptData?.brandName);
  const productType = normalizeText(gptData?.productType);
  const packagedState = normalizeText(gptData?.packagedState);
  const modelMenu = normalizeText(gptData?.menuName);
  const combined = `${subject} ${caption} ${brandName} ${productType} ${packagedState} ${modelMenu}`.trim();

  if (!combined || !DRINK_IMAGE_PATTERN.test(combined)) return null;

  // ถ้าภาพหลักเป็นสัตว์/คนถือเครื่องดื่ม ให้ถือเป็น meme/non-food ก่อน
  // เช่น ไก่ถือกาแฟ ไม่ควรบันทึกเป็นมื้อจริงของผู้ใช้
  if (NON_DRINK_MAIN_SUBJECT_PATTERN.test(subject) && !/(เครื่องดื่ม|แก้วน้ำ|กระป๋อง|ขวด|โค้ก|โค๊ก|โคล่า|coke|cola|กาแฟ|ชานม|โกโก้|น้ำอัดลม)/i.test(subject)) {
    return null;
  }

  const packagedProfile = detectPackagedDrinkProfile(combined);

  let menuName = normalizeText(gptData?.menuName);
  let kcal = safeNumber(gptData?.kcal, 0);
  let carb = safeNumber(gptData?.carb, 0);

  if (packagedProfile && (!menuName || /^(อาหาร|เครื่องดื่ม|เครื่องดื่มหวาน|กาแฟ|โกโก้|ชา|นม|น้ำอัดลม)$/i.test(menuName))) {
    menuName = packagedProfile.menuName;
    kcal = kcal || packagedProfile.kcal;
    carb = carb || packagedProfile.carb;
  }

  if (!menuName || menuName === "อาหาร") {
    if (/(zero|ซีโร่|ไม่มีน้ำตาล|0%)/i.test(combined)) {
      menuName = "โค้กซีโร่";
      kcal = kcal || 0;
      carb = carb || 0;
    } else if (/(โค้ก|โค๊ก|โคคา|โคล่า|coke|cola)/i.test(combined)) {
      menuName = "โค้ก";
      kcal = kcal || 140;
      carb = carb || 35;
    } else if (/(pepsi|เป๊ปซี่)/i.test(combined)) {
      menuName = "เป๊ปซี่";
      kcal = kcal || 140;
      carb = carb || 35;
    } else if (/(น้ำอัดลม|สไปรท์|แฟนต้า)/i.test(combined)) {
      menuName = "น้ำอัดลม";
      kcal = kcal || 140;
      carb = carb || 35;
    } else if (/(ชานม|ชาไทย|ชาเขียว|มัทฉะ)/i.test(combined)) {
      menuName = "ชานม/ชา";
      kcal = kcal || 220;
      carb = carb || 35;
    } else if (/(โกโก้|กาแฟ|นม|น้ำหวาน|หวานเย็น)/i.test(combined)) {
      menuName = "เครื่องดื่มหวาน";
      kcal = kcal || 180;
      carb = carb || 30;
    } else {
      menuName = "เครื่องดื่ม";
      kcal = kcal || 120;
      carb = carb || 25;
    }
  }

  return {
    ...gptData,
    isFood: true,
    menuName,
    kcal,
    carb,
    protein: safeNumber(gptData?.protein, 0),
    fat: safeNumber(gptData?.fat, 0),
    portionLevel: gptData?.portionLevel || "normal",
    portionNote: gptData?.portionNote || packagedProfile?.note || "เครื่องดื่มก็มีแคลนะ แปะนับให้แล้ว 👀",
    confidence: gptData?.confidence || "medium",
  };
};

const detectFoodCategory = (menuName) => {
  const text = normalizeText(menuName).toLowerCase();

  if (!text) return "meal";

  if (/(ชา|กาแฟ|โกโก้|มัทฉะ|นม|โซดา|น้ำผลไม้|สมูทตี้|latte|coffee|tea|milk|juice|smoothie)/i.test(text)) {
    return "drink";
  }

  if (/(เลย์|ขนม|คุกกี้|เค้ก|โดนัท|บราวนี่|โรตี|snack|cookie|cake|donut|dessert)/i.test(text)) {
    return "snack";
  }

  if (/(สลัด|ผลไม้|โยเกิร์ต|ต้มจืด|ซุป|เกาเหลา|ลวก|ยำ|salad|fruit|yogurt|soup)/i.test(text)) {
    return "light";
  }

  if (/(ก๋วยเตี๋ยว|บะหมี่|มาม่า|เส้น|สปาเกตตี|ก๋วยจั๊บ|noodle|pasta)/i.test(text)) {
    return "noodle";
  }

  return "meal";
};

const inferPortionInfo = ({ menuName, kcal, portionLevel, portionNote }) => {
  const providedLevel = normalizeText(portionLevel).toLowerCase();
  const providedNote = normalizeText(portionNote);

  const category = detectFoodCategory(menuName);
  const totalKcal = safeNumber(kcal, 0);

  if (providedLevel) {
    if (providedLevel === "light" || providedLevel === "small" || providedLevel === "เบา") {
      return {
        level: "light",
        label: "เบา",
        reaction: "🥗",
        note: providedNote || "มื้อนี้ดูไม่หนักมาก 🙂",
      };
    }

    if (providedLevel === "heavy" || providedLevel === "large" || providedLevel === "เยอะ") {
      return {
        level: "heavy",
        label: "ค่อนข้างเยอะ",
        reaction: "👀",
        note: providedNote || "จานนี้ดูแน่นกว่าปกตินิดนึง",
      };
    }

    return {
      level: "normal",
      label: "พอดี",
      reaction: "😋",
      note: providedNote || "ปริมาณประมาณหนึ่งมื้อพอดี 👌",
    };
  }

  let level = "normal";

  if (category === "drink") {
    if (totalKcal <= 120) level = "light";
    else if (totalKcal > 220) level = "heavy";
  } else if (category === "snack") {
    if (totalKcal <= 180) level = "light";
    else if (totalKcal > 320) level = "heavy";
  } else if (category === "light") {
    if (totalKcal <= 250) level = "light";
    else if (totalKcal > 450) level = "heavy";
  } else if (category === "noodle") {
    if (totalKcal <= 320) level = "light";
    else if (totalKcal > 600) level = "heavy";
  } else {
    if (totalKcal <= 350) level = "light";
    else if (totalKcal > 700) level = "heavy";
  }

  if (level === "light") {
    return {
      level,
      label: "เบา",
      reaction: "🥗",
      note: providedNote || "มื้อนี้ดูไม่หนักมาก 🙂",
    };
  }

  if (level === "heavy") {
    return {
      level,
      label: "ค่อนข้างเยอะ",
      reaction: "👀",
      note: providedNote || "จานนี้ดูแน่นกว่าปกตินิดนึง",
    };
  }

  return {
    level,
    label: "พอดี",
    reaction: "😋",
    note: providedNote || "ปริมาณประมาณหนึ่งมื้อพอดี 👌",
  };
};


const DRINK_MENU_PATTERN = /(ชานม|ชามะนาว|ชาไทย|ชาเขียว|ชาดำ|ชาเย็น|มัทฉะ|โกโก้|กาแฟ|ลาเต้|คาปูชิโน|อเมริกาโน่|นมเย็น|นมสด|โค้ก|โคก|โค๊ก|เป๊ปซี่|น้ำอัดลม|สไปรท์|แฟนต้า|น้ำหวาน|หวานเย็น|น้ำแดง|น้ำเขียว|น้ำผลไม้|สมูทตี้|เครื่องดื่ม|coke|cola|pepsi|coffee|tea|milk|cocoa|latte|smoothie|juice|moccona|มอคโคน่า|nescafe|เนสกาแฟ|birdy|เบอร์ดี้|milo|ไมโล|ovaltine|โอวัลติน)/i;
const SWEET_MENU_PATTERN = /(ของหวาน|ขนม|เค้ก|คุกกี้|โดนัท|บราวนี่|ไอศกรีม|บิงซู|ฮันนี่โทสต์|dessert|cookie|cake|donut|brownie|ice\s*cream|pudding|โรตี|แพนเค้ก|waffle|วาฟเฟิล|ครัวซองต์|ช็อกโกแลต)/i;
const SOLID_FOOD_PATTERN = /(ข้าว|หมู|ไก่|ปลา|กุ้ง|ไข่|เนื้อ|ก๋วยเตี๋ยว|บะหมี่|เส้น|ผัด|ทอด|ย่าง|ต้ม|แกง|ยำ|สลัด|ซุป|ผลไม้|มะม่วง|ส้มโอ|ส้ม|กล้วย|แตงโม|อาหาร|จาน|มื้อ|ขาหมู|กะเพรา|กระเพรา|ส้มตำ|ลาบ|หมูกระทะ|ชาบู|พิซซ่า|เบอร์เกอร์)/i;

const isDrinkMenu = (menuName = "") => {
  const name = String(menuName || "").trim();
  if (!name) return false;

  if (/^(ชา|นม|กาแฟ|โกโก้|โค้ก|โค๊ก|เป๊ปซี่|น้ำอัดลม|น้ำหวาน|เครื่องดื่ม)$/i.test(name)) return true;

  return DRINK_MENU_PATTERN.test(name);
};

const hasSolidFood = (meal = {}) => {
  const itemNames = Array.isArray(meal.items) ? meal.items.map((item) => item?.name).filter(Boolean).join(" + ") : "";
  const text = `${meal.menuName || ""} ${itemNames}`;
  return SOLID_FOOD_PATTERN.test(text);
};

const hasDrink = (meal = {}) => {
  const itemNames = Array.isArray(meal.items) ? meal.items.map((item) => item?.name).filter(Boolean).join(" + ") : "";
  const text = `${meal.menuName || ""} ${itemNames}`;
  return isDrinkMenu(text);
};

const buildNutritionLine = ({ carb = 0, protein = 0, fat = 0 } = {}) => {
  return `🥦 โภชนาการ: C ${Math.round(safeNumber(carb, 0))}g / P ${Math.round(safeNumber(protein, 0))}g / F ${Math.round(safeNumber(fat, 0))}g`;
};

const buildDrinkSugarLine = ({ menuName = "", kcal = 0, carb = 0, allowAnyDrink = false } = {}) => {
  if (!allowAnyDrink && !isDrinkMenu(menuName)) return "";

  const kcalValue = safeNumber(kcal, 0);
  const carbValue = safeNumber(carb, 0);

  if (/หวานน้อย|ไม่หวาน|0\s*%|zero|ซีโร่|sugar\s*free/i.test(menuName)) {
    return "🍬 น้ำตาล: น่าจะเบากว่าปกติ แต่อย่าเพิ่งไว้ใจหมดนะ 👀";
  }

  if (kcalValue >= 250 || carbValue >= 45) {
    return "🍬 น้ำตาล: น่าจะมาแน่นพอตัวเลยนะ 555+";
  }

  if (kcalValue >= 120 || carbValue >= 20) {
    return "🍬 น้ำตาล: มีมาพอให้แปะเห็นอยู่นะ 👀";
  }

  return "🍬 น้ำตาล: ดูไม่แรงมาก แต่ก็แปะไว้ก่อนนะ";
};

const buildImageDailyProgressMessage = ({ summary = {} }) => {
  const total = safeNumber(summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const over = Math.max(total - target, 0);
  const left = Math.max(target - total, 0);
  const progress = buildProgressBar(total, target);
  const status = over > 0
    ? `🔴 เกินเป้าไปประมาณ ${Math.round(over)} kcal`
    : `🟢 เหลือประมาณ ${Math.round(left)} kcal`;

  return `📊 วันนี้กินไปแล้ว
${Math.round(total)} / ${Math.round(target)} kcal
${status}
(${progress})`;
};

const buildImageInsight = ({ meal, summary, goalText }) => {
  const fat = safeNumber(meal?.fat, 0);
  const protein = safeNumber(meal?.protein, 0);
  const carb = safeNumber(meal?.carb, 0);
  const totalToday = safeNumber(summary?.todayCalories ?? summary?.totalToday, 0);
  const target = safeNumber(summary?.calorieTarget, DEFAULT_CALORIE_TARGET);
  const goal = normalizeText(goalText).toLowerCase();

  let macroLine = "ภาพรวมยังโอเคอยู่ 👌";

  if (fat >= 25) {
    macroLine = "ของทอด/มันเริ่มเด่นนิดนึงนะ 🫣";
  } else if (protein >= 20) {
    macroLine = "โปรตีนโอเคอยู่ 💪";
  } else if (carb >= 80) {
    macroLine = "คาร์บมาแน่นพอควรเลย 🍚";
  } else if (safeNumber(meal?.kcal, 0) <= 320) {
    macroLine = "มื้อนี้ค่อนข้างเบาเลย 😄";
  }

  let goalLine = "มื้อต่อไปค่อยบาลานซ์ต่อได้ 😄🍃";

  if (/ลด|คุม|ไขมัน|พุง/.test(goal)) {
    if (meal?.portionLevel === "heavy" || fat >= 25 || totalToday >= target) {
      goalLine = "เป้าลดไขมันยังไปต่อได้ แค่มื้อต่อไปเบาลงหน่อย 😄🍃";
    } else {
      goalLine = "เป้าลดไขมันยังคุมได้อยู่ 😄🍃";
    }
  } else if (/กล้าม|bulk|เพิ่มน้ำหนัก|โปรตีน/.test(goal)) {
    if (protein >= 20) {
      goalLine = "โปรตีนเริ่มโอเคกับเป้านะ 💪";
    } else {
      goalLine = "ถ้าอยากอิ่มนาน/เสริมกล้าม เพิ่มโปรตีนอีกนิดจะสวย 💪";
    }
  } else if (totalToday >= target) {
    goalLine = "วันนี้ใกล้เต็มแล้ว มื้อต่อไปเบา ๆ พอ 😮‍💨🍃";
  }

  return { macroLine, goalLine };
};

const buildImageFoodMessages = ({ meal, summary, title, session }) => {
  const includesDrink = hasDrink(meal);
  const includesSweet = hasSweet(meal);
  const includesSugarType = includesDrink || includesSweet;
  const includesSolid = hasSolidFood(meal) || (!includesSugarType);
  const sugarLine = includesSugarType ? buildDrinkSugarLine({ menuName: meal.menuName, kcal: meal.kcal, carb: meal.carb, allowAnyDrink: true }) : "";
  const nutritionLine = includesSolid ? buildNutritionLine({ carb: meal.carb, protein: meal.protein, fat: meal.fat }) : "";
  const detailLines = [nutritionLine, sugarLine].filter(Boolean).join("
");
  const firstMessage = `${meal.reaction} ${title} แปะดูให้แล้ว

🍽️ เมนู
${meal.menuName}
🔥 ~${meal.kcal} kcal${detailLines ? `
${detailLines}` : ""}
📏 ปริมาณ: ${meal.portionLabel}`;

  const { macroLine, goalLine } = buildImageInsight({
    meal,
    summary,
    goalText: session?.data?.goal || "",
  });

  const secondLines = [
    `💡 ${macroLine}`,
    goalLine,
  ];

  if (normalizeText(meal.confidence).toLowerCase() === "low") {
    secondLines.push("👀 แปะประเมินจากรูปคร่าว ๆ นะ");
  }

  return [firstMessage, buildImageDailyProgressMessage({ summary }), secondLines.join("\n")];
};

const IMAGE_BATCH_WINDOW_MS = 900;
const imageBatchByUser = new Map();

const getSessionForImage = async (userId) => {
  const sessionT = nowMs();
  const cachedSession = getCachedSession(userId);

  if (cachedSession) {
    logTiming("image", "getSessionMemoryHit", sessionT);
    return cachedSession;
  }

  const session = await postToSheet({ action: "GET_SESSION", userId });
  const normalized = {
    step: session?.step || "READY",
    data: session?.data || {},
    ...session,
  };
  setCachedSession(userId, normalized);
  logTiming("image", "getSession", sessionT);
  return normalized;
};

const analyzeImageEvent = async (event) => {
  const downloadT = nowMs();
  const base64Image = await getLineImageBase64(event.message.id);
  logTiming("image", "downloadLineImage", downloadT, `message=${event.message.id} base64Len=${base64Image.length}`);

  const aiT = nowMs();
  const gptData = await estimateFoodFromImage(base64Image);
  logTiming(
    "image",
    "openaiVision",
    aiT,
    `message=${event.message.id} menu=${gptData?.menuName || "unknown"} kcal=${gptData?.kcal || 0} subject=${gptData?.imageSubject || ""}`
  );

  const imageSubject = normalizeText(gptData?.imageSubject || gptData?.subject || gptData?.detectedObject || "");
  const imageCaption = normalizeText(gptData?.imageCaption || gptData?.caption || gptData?.sceneDescription || "");
  const drinkOverride = inferDrinkFromImage({ imageSubject, imageCaption, gptData });
  const analyzedData = drinkOverride || gptData;

  const kcal = safeNumber(analyzedData?.kcal, 0);
  const carb = safeNumber(analyzedData?.carb, 0);
  const protein = safeNumber(analyzedData?.protein, 0);
  const fat = safeNumber(analyzedData?.fat, 0);
  const menuName = normalizeText(analyzedData?.menuName) || "อาหาร";
  const isFoodImage = analyzedData?.isFood !== false;

  if (!isFoodImage || !menuName || kcal <= 0) {
    return {
      event,
      isFood: false,
      imageSubject,
      imageCaption,
      analyzedData,
    };
  }

  const portion = inferPortionInfo({
    menuName,
    kcal,
    portionLevel: analyzedData?.portionLevel,
    portionNote: analyzedData?.portionNote,
  });

  return {
    event,
    isFood: true,
    imageSubject,
    imageCaption,
    analyzedData,
    menuName,
    kcal,
    carb,
    protein,
    fat,
    portion,
    confidence: normalizeText(analyzedData?.confidence || analyzedData?.estimateConfidence || ""),
  };
};

const buildMealFromAnalyzedImages = (foodResults) => {
  const count = foodResults.length;
  const kcal = foodResults.reduce((sum, item) => sum + safeNumber(item.kcal, 0), 0);
  const carb = foodResults.reduce((sum, item) => sum + safeNumber(item.carb, 0), 0);
  const protein = foodResults.reduce((sum, item) => sum + safeNumber(item.protein, 0), 0);
  const fat = foodResults.reduce((sum, item) => sum + safeNumber(item.fat, 0), 0);
  const menuNames = foodResults.map((item) => item.menuName).filter(Boolean);
  const menuName = count === 1 ? menuNames[0] : menuNames.join(" + ");

  const portion = count === 1
    ? foodResults[0].portion
    : inferPortionInfo({
      menuName,
      kcal,
      portionLevel: kcal > 700 ? "heavy" : "normal",
      portionNote: `รอบนี้แปะรวมจาก ${count} รูปให้นะ 👀`,
    });

  const imageItems = foodResults.map((item) => ({
    name: item.menuName,
    kcal: item.kcal,
    carb: item.carb,
    protein: item.protein,
    fat: item.fat,
    portionLevel: item.portion?.level || "normal",
    portionLabel: item.portion?.label || "พอดี",
    portionNote: item.portion?.note || "แปะประเมินจากรูปคร่าว ๆ นะ",
    source: "image_estimate",
    messageId: item.event?.message?.id || "",
  }));

  return {
    menuName,
    kcal,
    carb,
    protein,
    fat,
    imageItems,
    portion,
    confidence: foodResults.some((item) => item.confidence === "low") ? "low" : "medium",
  };
};

const processImageBatch = async ({ userId, events }) => {
  const totalT = nowMs();
  const firstEvent = events[0];
  console.log(`[PaeCalTiming] imageBatch:start user=${userId || "unknown"} count=${events.length}`);

  const cachedSession = getCachedSession(userId);

  let ackSent = false;
  if (cachedSession?.step === "READY") {
    const ackT = nowMs();
    await replyText(firstEvent.replyToken, "ขอแปะดูแป๊ป 👀")
      .then(() => {
        ackSent = true;
        logTiming("image", "replyAck", ackT);
      })
      .catch((err) => console.warn("[PaeCalTiming] image:replyAck failed", err?.message || err));
  }

  const session = await getSessionForImage(userId);

  if (session.step !== "READY") {
    const pushT = nowMs();
    await pushTexts(userId, [
      ["แปะขอรู้จักลื้อก่อนน้า", "พิมพ์ชื่อมาก่อนเลยจ้า 😊"].join("\n"),
    ]);
    logTiming("image", "pushNeedProfile", pushT);
    logTiming("imageBatch", "total", totalT);
    return;
  }

  if (!ackSent) {
    const ackT = nowMs();
    await replyText(firstEvent.replyToken, "ขอแปะดูแป๊ป 👀")
      .then(() => {
        ackSent = true;
        logTiming("image", "replyAck", ackT);
      })
      .catch((err) => console.warn("[PaeCalTiming] image:replyAck failed", err?.message || err));
  }

  const analyzeT = nowMs();
  const analyzedResults = await Promise.all(events.map((event) => analyzeImageEvent(event)));
  logTiming("imageBatch", "analyzeAll", analyzeT, `count=${analyzedResults.length}`);

  const foodResults = analyzedResults.filter((item) => item.isFood);

  if (foodResults.length === 0) {
    const firstNoFood = analyzedResults[0] || {};
    const pushNoFoodT = nowMs();
    await pushTexts(userId, [renderNoFoodDetectedReply({
      imageSubject: firstNoFood.imageSubject,
      imageCaption: firstNoFood.imageCaption,
    })]);
    logTiming("image", "pushNoFood", pushNoFoodT, `subject=${firstNoFood.imageSubject || "unknown"}`);
    logTiming("imageBatch", "total", totalT);
    return;
  }

  const portionT = nowMs();
  const mealDraft = buildMealFromAnalyzedImages(foodResults);
  logTiming("image", "buildPortion", portionT, `portion=${mealDraft.portion?.level || "normal"} imageCount=${foodResults.length}`);

  const firstMessageId = firstEvent.message?.id || "image";
  const requestId = `${firstMessageId}:image-batch-${events.length}`;
  const logFoodT = nowMs();
  const sheetData = await postToSheet({
    action: "LOG_FOOD",
    userId,
    name: session.data?.name || "",
    kcal: mealDraft.kcal,
    carb: mealDraft.carb,
    protein: mealDraft.protein,
    fat: mealDraft.fat,
    menuName: mealDraft.menuName,
    requestId,
    itemsJson: JSON.stringify(mealDraft.imageItems),
  });
  logTiming("image", "sheetLogFood", logFoodT, `imageCount=${foodResults.length}`);

  const buildT = nowMs();
  const beforeTotal = resolveCachedTodayCalories(session);
  const sheetTotal = safeNumber(sheetData.todayCalories ?? sheetData.totalToday, 0);
  const total = sheetTotal > 0 ? sheetTotal : Math.max(beforeTotal + mealDraft.kcal, mealDraft.kcal);
  const target = sheetData.calorieTarget || session?.calorieTarget || session?.data?.calorieTarget || DEFAULT_CALORIE_TARGET;
  const summary = {
    ...sheetData,
    todayCalories: total,
    totalToday: total,
    calorieTarget: target,
  };
  refreshSummaryCacheFromSheetResponse(userId, summary);
  console.log(`[PaeCalTiming] image:summaryResolved before=${beforeTotal} sheet=${sheetTotal} meal=${mealDraft.kcal} total=${total}`);

  const meal = {
    menuName: mealDraft.menuName,
    kcal: mealDraft.kcal,
    carb: mealDraft.carb,
    protein: mealDraft.protein,
    fat: mealDraft.fat,
    requestId,
    items: mealDraft.imageItems,
    portionLevel: mealDraft.portion?.level || "normal",
    portionLabel: mealDraft.portion?.label || "พอดี",
    portionNote: mealDraft.portion?.note || "แปะประเมินจากรูปคร่าว ๆ นะ",
    reaction: mealDraft.portion?.reaction || "😋",
    confidence: mealDraft.confidence,
  };
  logTiming("image", "buildSummaryObjects", buildT);

  const syncT = nowMs();
  mergeCachedSession(userId, session, {
    calorieTarget: target,
    todayCalories: total,
    totalToday: total,
    lastMeal: meal,
  });
  logTiming("image", "syncSessionMemoryOnly", syncT);

  const renderT = nowMs();
  const title = resolveFastTitle(session);
  const messages = buildImageFoodMessages({
    meal,
    summary,
    title,
    session,
  });
  logTiming("image", "renderMessages", renderT, `count=${messages.length}`);

  const pushT = nowMs();
  await pushTexts(userId, messages);
  logTiming("image", "pushResult", pushT);

  logTiming("imageBatch", "total", totalT);
};

export const handleImageMessage = async (event) => {
  const userId = event.source.userId;
  console.log(`[PaeCalTiming] image:queued user=${userId || "unknown"} message=${event.message?.id || "unknown"}`);

  const existing = imageBatchByUser.get(userId) || { userId, events: [], timer: null };
  existing.events.push(event);

  if (existing.timer) clearTimeout(existing.timer);
  existing.timer = setTimeout(() => {
    const batch = imageBatchByUser.get(userId);
    imageBatchByUser.delete(userId);

    if (!batch?.events?.length) return;

    processImageBatch({ userId, events: batch.events }).catch((err) => {
      console.error("[PaeCalTiming] imageBatch:error", err?.message || err);
      pushTexts(userId, ["แปะสะดุดตอนดูรูปนิดนึง 😅\nส่งมาใหม่อีกที เดี๋ยวแปะดูให้"]).catch(() => {});
    });
  }, IMAGE_BATCH_WINDOW_MS);

  imageBatchByUser.set(userId, existing);
};
