const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const THAI_NUMBER_WORDS = {
  หนึ่ง: 1,
  นึง: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
  สิบ: 10,
};

const normalizeText = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/^วันนี้กิน\s*/i, "")
  .replace(/^เมื่อกี้กิน\s*/i, "")
  .replace(/^กิน\s*/i, "")
  .replace(/\s+/g, " ");

const compactText = (text = "") => normalizeText(text)
  .replace(/[ๆ๊๋่้็์]/g, "")
  .replace(/\s+/g, "")
  .replace(/กระเพรา/g, "กะเพรา")
  .replace(/กะเพา/g, "กะเพรา")
  .replace(/กระเพา/g, "กะเพรา")
  .replace(/ก๊วยเตี๋ยว|กวยเตี๋ยว/g, "ก๋วยเตี๋ยว")
  .replace(/โค๊ก/g, "โค้ก")
  .replace(/อเมริกาโน(?!่)/g, "อเมริกาโน่")
  .replace(/เมกาโน/g, "อเมริกาโน่")
  .replace(/ลาเต(?!้)/g, "ลาเต้")
  .replace(/คาปูชิโน(?!่)/g, "คาปูชิโน่")
  .replace(/คาปู$/g, "คาปูชิโน่")
  .replace(/โกโก(?!้)/g, "โกโก้")
  .replace(/หมุปิ้ง/g, "หมูปิ้ง");

const round = (value) => Math.round(Number(value) || 0);
const toArabicDigits = (value = "") => String(value).replace(/[๐-๙]/g, (char) => String(THAI_DIGITS.indexOf(char)));
const parseCountToken = (token = "") => {
  const value = toArabicDigits(token).trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Math.max(1, Number(value));
  return THAI_NUMBER_WORDS[value] || null;
};

const parseCountBeforeUnit = (value = "", units = "") => {
  const normalized = toArabicDigits(value);
  const match = normalized.match(new RegExp(`(\\d+|หนึ่ง|นึง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)(?=${units})`));
  return parseCountToken(match?.[1]) || 1;
};

const PRESETS = [
  { id: "rice_white", aliases: ["ข้าวสวย", "ข้าวเปล่า", "ข้าวขาว"], menuName: "ข้าวสวย", kcal: 250, carb: 55, protein: 4, fat: 1 },
  { id: "rice_brown", aliases: ["ข้าวกล้อง"], menuName: "ข้าวกล้อง", kcal: 230, carb: 48, protein: 5, fat: 2 },
  { id: "sticky_rice", aliases: ["ข้าวเหนียว", "ข้าวเหนียวนึ่ง"], menuName: "ข้าวเหนียว", kcal: 250, carb: 55, protein: 5, fat: 1 },
  { id: "chicken_rice", aliases: ["ข้าวมันไก่", "ข้าวมันไก่ต้ม"], menuName: "ข้าวมันไก่ต้ม", kcal: 650, carb: 80, protein: 32, fat: 22 },
  { id: "fried_chicken_rice", aliases: ["ข้าวมันไก่ทอด"], menuName: "ข้าวมันไก่ทอด", kcal: 780, carb: 85, protein: 30, fat: 35 },
  { id: "red_pork_rice", aliases: ["ข้าวหมูแดง"], menuName: "ข้าวหมูแดง", kcal: 620, carb: 82, protein: 28, fat: 20, sugar: 10 },
  { id: "crispy_pork_rice", aliases: ["ข้าวหมูกรอบ"], menuName: "ข้าวหมูกรอบ", kcal: 780, carb: 82, protein: 28, fat: 38 },
  { id: "red_crispy_pork_rice", aliases: ["ข้าวหมูแดงหมูกรอบ", "ข้าวหมูแดงหมูกรอบรวม"], menuName: "ข้าวหมูแดงหมูกรอบ", kcal: 760, carb: 85, protein: 30, fat: 35, sugar: 10 },
  { id: "duck_rice", aliases: ["ข้าวหน้าเป็ด", "ข้าวเป็ดย่าง", "เป็ดย่างราดข้าว"], menuName: "ข้าวหน้าเป็ด", kcal: 700, carb: 82, protein: 32, fat: 28, sugar: 8 },
  { id: "pork_leg_rice", aliases: ["ข้าวขาหมู"], menuName: "ข้าวขาหมู", kcal: 800, carb: 85, protein: 36, fat: 35 },
  { id: "shrimp_paste_rice", aliases: ["ข้าวคลุกกะปิ", "ข้าวคลุกกระปิ"], menuName: "ข้าวคลุกกะปิ", kcal: 650, carb: 85, protein: 24, fat: 24, sugar: 12 },
  { id: "fried_chicken_over_rice", aliases: ["ข้าวไก่ทอด", "ไก่ทอดราดข้าว"], menuName: "ข้าวไก่ทอด", kcal: 720, carb: 82, protein: 30, fat: 30 },
  { id: "fried_pork_rice", aliases: ["ข้าวหมูทอด", "หมูทอดราดข้าว"], menuName: "ข้าวหมูทอด", kcal: 750, carb: 85, protein: 30, fat: 34 },
  { id: "creamy_egg_rice", aliases: ["ข้าวไข่ข้น", "ไข่ข้นราดข้าว"], menuName: "ข้าวไข่ข้น", kcal: 520, carb: 58, protein: 18, fat: 24 },
  { id: "rice_soup", aliases: ["ข้าวต้ม", "ข้าวต้มหมู", "ข้าวต้มไก่"], menuName: "ข้าวต้ม", kcal: 300, carb: 42, protein: 18, fat: 7 },
  { id: "jok", aliases: ["โจ๊ก", "โจ๊กหมู", "โจ๊กไก่"], menuName: "โจ๊ก", kcal: 330, carb: 48, protein: 18, fat: 8 },
  { id: "basil_pork", aliases: ["ข้าวกะเพราหมู", "ข้าวกระเพราหมู", "ข้าวกระเพาหมู", "กะเพราหมู", "กระเพราหมู", "กะเพาหมู"], menuName: "ข้าวกะเพราหมู", kcal: 650, carb: 75, protein: 28, fat: 28 },
  { id: "basil_pork_egg", aliases: ["ข้าวกะเพราหมูไข่ดาว", "ข้าวกระเพราหมูไข่ดาว", "ข้าวกระเพาหมูไข่ดาว", "กะเพราหมูไข่ดาว"], menuName: "ข้าวกะเพราหมูไข่ดาว", kcal: 820, carb: 80, protein: 34, fat: 38 },
  { id: "basil_chicken", aliases: ["ข้าวกะเพราไก่", "ข้าวกระเพราไก่", "ข้าวกระเพาไก่", "กะเพราไก่", "กระเพราไก่", "กะเพาไก่"], menuName: "ข้าวกะเพราไก่", kcal: 600, carb: 75, protein: 30, fat: 20 },
  { id: "basil_beef", aliases: ["ข้าวกะเพราเนื้อ", "ข้าวกระเพราเนื้อ", "ข้าวกระเพาเนื้อ", "กะเพราเนื้อ", "กระเพราเนื้อ", "กะเพาเนื้อ"], menuName: "ข้าวกะเพราเนื้อ", kcal: 700, carb: 75, protein: 34, fat: 30 },
  { id: "fried_rice", aliases: ["ข้าวผัด", "ข้าวผัดหมู", "ข้าวผัดไก่"], menuName: "ข้าวผัด", kcal: 650, carb: 85, protein: 22, fat: 24 },
  { id: "crab_fried_rice", aliases: ["ข้าวผัดปู"], menuName: "ข้าวผัดปู", kcal: 620, carb: 82, protein: 24, fat: 22 },
  { id: "shrimp_fried_rice", aliases: ["ข้าวผัดกุ้ง"], menuName: "ข้าวผัดกุ้ง", kcal: 630, carb: 82, protein: 28, fat: 20 },
  { id: "sour_sausage_fried_rice", aliases: ["ข้าวผัดแหนม"], menuName: "ข้าวผัดแหนม", kcal: 700, carb: 85, protein: 24, fat: 28 },
  { id: "omelet_rice", aliases: ["ข้าวไข่เจียว"], menuName: "ข้าวไข่เจียว", kcal: 550, carb: 60, protein: 16, fat: 28 },
  { id: "garlic_pork_rice", aliases: ["ข้าวหมูกระเทียม"], menuName: "ข้าวหมูกระเทียม", kcal: 700, carb: 80, protein: 32, fat: 28 },
  { id: "garlic_chicken_rice", aliases: ["ข้าวไก่กระเทียม"], menuName: "ข้าวไก่กระเทียม", kcal: 650, carb: 80, protein: 34, fat: 20 },
  { id: "pork_skewer", aliases: ["หมูปิ้ง", "หมุปิ้ง", "หมูปิ้งโบราณ", "หมูปิ้งนมสด", "หมูเสียบไม้", "หมูไม้"], menuName: "หมูปิ้งโบราณ", kcal: 140, carb: 4, protein: 9, fat: 10, sugar: 2, unit: "ไม้", countUnit: "ไม้" },
  { id: "fried_pork_skewer", aliases: ["หมูทอดเสียบไม้", "หมูทอดไม้", "หมูทอดไม้เสียบ"], menuName: "หมูทอดเสียบไม้", kcal: 180, carb: 8, protein: 10, fat: 12, unit: "ไม้", countUnit: "ไม้" },
  { id: "school_fried_chicken", aliases: ["ไก่ทอดหน้าโรงเรียน", "ไก่ทอดโรงเรียน"], menuName: "ไก่ทอดหน้าโรงเรียน", kcal: 260, carb: 12, protein: 18, fat: 16 },
  { id: "grilled_chicken", aliases: ["ไก่ย่าง"], menuName: "ไก่ย่าง", kcal: 280, carb: 3, protein: 32, fat: 16 },
  { id: "grilled_pork_neck", aliases: ["คอหมูย่าง", "หมูสันคอย่าง", "สันคอย่าง"], menuName: "คอหมูย่าง", kcal: 420, carb: 5, protein: 28, fat: 32 },
  { id: "mookata", aliases: ["หมูกระทะ", "หมูทะ"], menuName: "หมูกระทะ", kcal: 900, carb: 70, protein: 45, fat: 50 },
  { id: "shabu", aliases: ["ชาบู"], menuName: "ชาบู", kcal: 650, carb: 45, protein: 45, fat: 32 },
  { id: "suki_soup", aliases: ["สุกี้น้ำ", "สุกี้"], menuName: "สุกี้น้ำ", kcal: 350, carb: 35, protein: 28, fat: 10 },
  { id: "suki_dry", aliases: ["สุกี้แห้ง"], menuName: "สุกี้แห้ง", kcal: 500, carb: 45, protein: 30, fat: 22 },
  { id: "noodle_soup", aliases: ["ก๋วยเตี๋ยวน้ำ", "ก๋วยเตี๋ยว", "กวยเตี๋ยว", "ก๊วยเตี๋ยว", "เตี๋ยว"], menuName: "ก๋วยเตี๋ยวน้ำ", kcal: 400, carb: 55, protein: 22, fat: 10 },
  { id: "tomyum_noodle", aliases: ["ก๋วยเตี๋ยวต้มยำ", "กวยเตี๋ยวต้มยำ", "เตี๋ยวต้มยำ"], menuName: "ก๋วยเตี๋ยวต้มยำ", kcal: 450, carb: 60, protein: 22, fat: 15 },
  { id: "wonton_noodle", aliases: ["บะหมี่เกี๊ยว"], menuName: "บะหมี่เกี๊ยว", kcal: 500, carb: 65, protein: 24, fat: 16 },
  { id: "ramen", aliases: ["ราเมง", "ramen"], menuName: "ราเมง", kcal: 650, carb: 80, protein: 28, fat: 25 },
  { id: "pad_thai", aliases: ["ผัดไทย"], menuName: "ผัดไทย", kcal: 650, carb: 85, protein: 22, fat: 25 },
  { id: "pad_see_ew", aliases: ["ผัดซีอิ๊ว", "ผัดซีอิ้ว"], menuName: "ผัดซีอิ๊ว", kcal: 700, carb: 90, protein: 25, fat: 28 },
  { id: "papaya_salad", aliases: ["ส้มตำ", "ส้มตํา"], menuName: "ส้มตำ", kcal: 150, carb: 30, protein: 5, fat: 2, sugar: 12 },
  { id: "larb_pork", aliases: ["ลาบหมู"], menuName: "ลาบหมู", kcal: 300, carb: 12, protein: 28, fat: 16 },
  { id: "glass_noodle_salad", aliases: ["ยำวุ้นเส้น", "ยําวุ้นเส้น"], menuName: "ยำวุ้นเส้น", kcal: 280, carb: 42, protein: 18, fat: 6, sugar: 8 },
  { id: "chicken_salad", aliases: ["สลัดอกไก่"], menuName: "สลัดอกไก่", kcal: 320, carb: 20, protein: 35, fat: 12 },
  { id: "boiled_egg", aliases: ["ไข่ต้ม"], menuName: "ไข่ต้ม", kcal: 70, carb: 0.6, protein: 6.3, fat: 5.2, unit: "ฟอง", countUnit: "ฟอง" },
  { id: "soft_boiled_egg", aliases: ["ไข่ลวก"], menuName: "ไข่ลวก", kcal: 70, carb: 0.6, protein: 6.3, fat: 5.2, unit: "ฟอง", countUnit: "ฟอง" },
  { id: "fried_egg", aliases: ["ไข่ดาว"], menuName: "ไข่ดาว", kcal: 180, carb: 1, protein: 7, fat: 16, unit: "ฟอง", countUnit: "ฟอง" },
  { id: "omelet", aliases: ["ไข่เจียว"], menuName: "ไข่เจียว", kcal: 250, carb: 2, protein: 12, fat: 22 },
  { id: "fish_ball", aliases: ["ลูกชิ้นปลา", "ลูกชิ้นปลาลวก"], menuName: "ลูกชิ้นปลา", kcal: 240, carb: 28, protein: 18, fat: 7 },
  { id: "shrimp_ball", aliases: ["ลูกชิ้นกุ้ง", "ลูกชิ้นกุ้งทอด", "ลูกชิ้นกุ้งลวก"], menuName: "ลูกชิ้นกุ้ง", kcal: 600, carb: 30, protein: 45, fat: 15 },
  { id: "fried_meatballs", aliases: ["ลูกชิ้นทอด", "ลูกชิ้นรวมทอด"], menuName: "ลูกชิ้นทอด", kcal: 320, carb: 32, protein: 16, fat: 16 },
  { id: "sausage", aliases: ["ไส้กรอก", "ไส้กรอกทอด"], menuName: "ไส้กรอก", kcal: 320, carb: 8, protein: 12, fat: 28 },
  { id: "isan_sausage", aliases: ["ไส้กรอกอีสาน", "ไส้กรอกอิสาน"], menuName: "ไส้กรอกอีสาน", kcal: 260, carb: 18, protein: 11, fat: 16 },
  { id: "nuggets", aliases: ["นักเก็ต", "นักเกต", "nugget", "nuggets"], menuName: "นักเก็ต", kcal: 280, carb: 18, protein: 14, fat: 17 },
  { id: "chicken_pop", aliases: ["ไก่ป๊อป", "ไก่ปอป", "chickenpop"], menuName: "ไก่ป๊อป", kcal: 320, carb: 24, protein: 18, fat: 18 },
  { id: "fries", aliases: ["เฟรนช์ฟราย", "เฟรนฟราย", "เฟรนฟรายส์", "frenchfries", "fries"], menuName: "เฟรนช์ฟราย", kcal: 330, carb: 45, protein: 4, fat: 15 },
  { id: "fried_wonton", aliases: ["เกี๊ยวทอด", "เกี๊ยวกรอบ"], menuName: "เกี๊ยวทอด", kcal: 280, carb: 32, protein: 8, fat: 14 },
  { id: "chicken_roll", aliases: ["ไก่จ๊อ", "ไก่จอ"], menuName: "ไก่จ๊อ", kcal: 300, carb: 20, protein: 18, fat: 18 },
  { id: "spring_roll", aliases: ["ปอเปี๊ยะทอด", "ปอเปี๊ยะ", "เปาะเปี๊ยะทอด"], menuName: "ปอเปี๊ยะทอด", kcal: 260, carb: 32, protein: 6, fat: 12 },
  { id: "oreo", aliases: ["โอริโอ", "โอริโอ้", "oreo"], menuName: "โอริโอ", kcal: 260, carb: 38, protein: 3, fat: 11, sugar: 22 },
  { id: "pocky", aliases: ["ป๊อกกี้", "pocky"], menuName: "ป๊อกกี้", kcal: 220, carb: 32, protein: 4, fat: 9, sugar: 18 },
  { id: "coke_zero", aliases: ["โค้กซีโร่", "โค้ก zero", "coke zero"], menuName: "โค้กซีโร่", kcal: 0, carb: 0, protein: 0, fat: 0, sugar: 0 },
  { id: "coke", aliases: ["โค้ก", "โค๊ก", "coke"], menuName: "โค้กกระป๋อง", kcal: 140, carb: 35, protein: 0, fat: 0, sugar: 35 },
  { id: "americano", aliases: ["อเมริกาโน่", "อเมริกาโน", "เมกาโน่", "อเม", "americano", "กาแฟดำ", "กาแฟไม่ใส่นม"], menuName: "อเมริกาโน่ / กาแฟดำ", kcal: 15, carb: 2, protein: 1, fat: 0, sugar: 0 },
  { id: "latte", aliases: ["ลาเต้", "ลาเต", "latte"], menuName: "ลาเต้", kcal: 150, carb: 12, protein: 7, fat: 7, sugar: 10 },
  { id: "cappuccino", aliases: ["คาปูชิโน่", "คาปูชิโน", "คาปู", "cappuccino"], menuName: "คาปูชิโน่", kcal: 120, carb: 10, protein: 6, fat: 6, sugar: 8 },
  { id: "thai_tea", aliases: ["ชาไทย", "ชาเย็น"], menuName: "ชาไทย", kcal: 220, carb: 38, protein: 3, fat: 6, sugar: 32 },
  { id: "milk_tea", aliases: ["ชานม", "ชานมไข่มุก", "bubbletea", "boba"], menuName: "ชานม", kcal: 300, carb: 55, protein: 5, fat: 8, sugar: 42 },
  { id: "green_tea", aliases: ["ชาเขียว", "ชาเขียวนม", "ชาเขียวเย็น"], menuName: "ชาเขียวนม", kcal: 220, carb: 35, protein: 5, fat: 7, sugar: 28 },
  { id: "matcha_latte", aliases: ["มัทฉะลาเต้", "มัจฉะลาเต้", "matchalatte"], menuName: "มัทฉะลาเต้", kcal: 180, carb: 22, protein: 8, fat: 7, sugar: 18 },
  { id: "cocoa", aliases: ["โกโก้", "โกโก", "cocoa"], menuName: "โกโก้", kcal: 250, carb: 38, protein: 6, fat: 8, sugar: 30 },
  { id: "old_school_coffee", aliases: ["กาแฟโบราณ", "กาแฟเย็นโบราณ"], menuName: "กาแฟโบราณ", kcal: 200, carb: 34, protein: 3, fat: 6, sugar: 30 },
  { id: "oliang", aliases: ["โอเลี้ยง", "โอเลียง"], menuName: "โอเลี้ยง", kcal: 120, carb: 30, protein: 0, fat: 0, sugar: 28 },
  { id: "oliang_milk", aliases: ["โอเลี้ยงยกล้อ", "โอเลียงยกล้อ"], menuName: "โอเลี้ยงยกล้อ", kcal: 180, carb: 34, protein: 3, fat: 5, sugar: 30 },
  { id: "thai_iced_coffee", aliases: ["เอสเย็น", "กาแฟเอสเย็น", "เอสเปรสโซ่เย็น", "espressoเย็น"], menuName: "เอสเย็น", kcal: 220, carb: 34, protein: 5, fat: 8, sugar: 28 },
  { id: "mocha", aliases: ["มอคค่า", "mocha"], menuName: "มอคค่า", kcal: 220, carb: 30, protein: 7, fat: 8, sugar: 24 },
  { id: "fresh_milk", aliases: ["นมสด", "นมสดเย็น"], menuName: "นมสด", kcal: 180, carb: 20, protein: 8, fat: 7, sugar: 18 },
  { id: "pink_milk", aliases: ["นมชมพู", "นมเย็น"], menuName: "นมชมพู", kcal: 240, carb: 40, protein: 7, fat: 7, sugar: 36 },
  { id: "soy_milk", aliases: ["น้ำเต้าหู้", "นมถั่วเหลือง"], menuName: "น้ำเต้าหู้", kcal: 120, carb: 16, protein: 7, fat: 4, sugar: 10 },
  { id: "orange_juice", aliases: ["น้ำส้ม", "น้ำส้มคั้น"], menuName: "น้ำส้ม", kcal: 140, carb: 34, protein: 2, fat: 0, sugar: 28 },
  { id: "coconut_water", aliases: ["น้ำมะพร้าว", "น้ำมะพร้าวสด"], menuName: "น้ำมะพร้าว", kcal: 90, carb: 22, protein: 1, fat: 0, sugar: 18 },
  { id: "red_soda", aliases: ["น้ำแดงโซดา", "แดงโซดา"], menuName: "น้ำแดงโซดา", kcal: 180, carb: 45, protein: 0, fat: 0, sugar: 42 },
  { id: "honey_lime", aliases: ["น้ำผึ้งมะนาว", "น้ำผึ้งมะนาวโซดา"], menuName: "น้ำผึ้งมะนาว", kcal: 160, carb: 40, protein: 0, fat: 0, sugar: 36 },
  { id: "cheese_baron", aliases: ["กรีกโยเกิร์ตบารอน", "โยเกิร์ตบารอน", "ชีสบารอน", "thecheesebaron", "cheesebaron"], menuName: "กรีกโยเกิร์ตบารอน ออริจินัล", kcal: 160, carb: 5, protein: 9, fat: 11, sugar: 2 },
  { id: "avocado_smoothie", aliases: ["อโวคาโดปั่น", "อะโวคาโดปั่น", "avocado"], menuName: "อโวคาโดปั่น", kcal: 320, carb: 28, protein: 4, fat: 22, sugar: 8 },
];

const aliasMatches = (entry, value) => entry.aliases.some((alias) => value.includes(compactText(alias)));

const applyCount = (entry, text) => {
  if (!entry.countUnit) return { count: 1, quantity: entry.unit || "1 เสิร์ฟ" };
  const count = parseCountBeforeUnit(compactText(text), entry.countUnit);
  return { count, quantity: `${count} ${entry.countUnit}` };
};

const buildMeal = (entry, count = 1) => ({
  menuName: `${entry.menuName}${count > 1 && entry.countUnit ? ` ${count} ${entry.countUnit}` : ""}`,
  kcal: round(entry.kcal * count),
  carb: round(entry.carb * count),
  protein: round(entry.protein * count),
  fat: round(entry.fat * count),
  sugar: round((entry.sugar || 0) * count),
  confidence: "high",
  estimateMode: "top_food_preset",
});

export const resolveTopFoodPreset = (text = "") => {
  const value = compactText(text);
  if (!value) return null;

  const entry = PRESETS.find((preset) => aliasMatches(preset, value));
  if (!entry) return null;

  const { count, quantity } = applyCount(entry, text);
  const meal = buildMeal(entry, count);
  return {
    ...meal,
    items: [{ name: meal.menuName, quantity, kcal: meal.kcal }],
  };
};

export const TOP_FOOD_PRESET_COUNT = PRESETS.length;
