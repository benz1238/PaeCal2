const normalizeText = (text = "") => String(text || "")
  .trim()
  .toLowerCase()
  .replace(/^วันนี้กิน\s*/i, "")
  .replace(/^เมื่อกี้กิน\s*/i, "")
  .replace(/^กิน\s*/i, "")
  .replace(/\s+/g, " ");

const compactText = (text = "") => normalizeText(text).replace(/\s+/g, "");
const round = (value) => Math.round(Number(value) || 0);
const clamp = (value, min = 0) => Math.max(min, round(value));
const makeItem = (meal, quantity = "1 เสิร์ฟ") => ({ name: meal.menuName, quantity, kcal: meal.kcal });
const withDefaults = (meal, estimateMode = "local_food_rules") => ({ sugar: 0, confidence: "high", estimateMode, ...meal, kcal: round(meal.kcal), carb: round(meal.carb), protein: round(meal.protein), fat: round(meal.fat) });

const PRESETS = [
  { pattern: /อกไก่ทอด/, menuName: "อกไก่ทอด", kcal: 320, carb: 15, protein: 35, fat: 15, priority: 100 },
  { pattern: /อกไก่ย่าง/, menuName: "อกไก่ย่าง", kcal: 200, carb: 0, protein: 38, fat: 6, priority: 100 },
  { pattern: /อกไก่ต้ม|อกไก่นึ่ง|^อกไก่$/, menuName: "อกไก่ต้ม", kcal: 180, carb: 0, protein: 38, fat: 4, priority: 90 },
  { pattern: /สะโพกไก่ทอด/, menuName: "สะโพกไก่ทอด", kcal: 420, carb: 20, protein: 30, fat: 26, priority: 100 },
  { pattern: /สะโพกไก่ย่าง/, menuName: "สะโพกไก่ย่าง", kcal: 300, carb: 0, protein: 30, fat: 18, priority: 100 },
  { pattern: /สะโพกไก่ต้ม|สะโพกไก่นึ่ง|^สะโพกไก่$/, menuName: "สะโพกไก่ต้ม", kcal: 260, carb: 0, protein: 28, fat: 16, priority: 90 },
  { pattern: /ไก่ทอด/, menuName: "ไก่ทอด", kcal: 450, carb: 25, protein: 30, fat: 28 },
  { pattern: /ไก่ย่าง/, menuName: "ไก่ย่าง", kcal: 280, carb: 3, protein: 32, fat: 16 },
  { pattern: /ไก่ต้ม|ไก่นึ่ง/, menuName: "ไก่ต้ม", kcal: 250, carb: 0, protein: 32, fat: 13 },
  { pattern: /กาแฟดำ|อเมริกาโน่|อเมริกาโน|americano|blackcoffee/, menuName: "อเมริกาโน่ / กาแฟดำ", kcal: 15, carb: 2, protein: 1, fat: 0, sugar: 0 },
  { pattern: /ลาเต้|latte/, menuName: "ลาเต้", kcal: 150, carb: 12, protein: 7, fat: 7, sugar: 10 },
  { pattern: /คาปูชิโน่|คาปูชิโน|cappuccino/, menuName: "คาปูชิโน่", kcal: 120, carb: 10, protein: 6, fat: 6, sugar: 8 },
  { pattern: /อโวคาโดปั่นน้ำผึ้ง|อะโวคาโดปั่นน้ำผึ้ง|avocadohoney/, menuName: "อโวคาโดปั่นน้ำผึ้ง", kcal: 360, carb: 42, protein: 4, fat: 22, sugar: 22 },
  { pattern: /อโวคาโดปั่น|อะโวคาโดปั่น|avocado/, menuName: "อโวคาโดปั่น", kcal: 320, carb: 28, protein: 4, fat: 22, sugar: 8 },
  { pattern: /ข้าวมันไก่ทอด/, menuName: "ข้าวมันไก่ทอด", kcal: 780, carb: 85, protein: 30, fat: 35 },
  { pattern: /ข้าวมันไก่|ข้าวมันไก่ต้ม/, menuName: "ข้าวมันไก่ต้ม", kcal: 650, carb: 80, protein: 32, fat: 22 },
  { pattern: /ข้าวกะเพราไก่ไข่ดาว|ข้าวกระเพราไก่ไข่ดาว/, menuName: "ข้าวกะเพราไก่ไข่ดาว", kcal: 780, carb: 80, protein: 35, fat: 32 },
  { pattern: /ข้าวกะเพราไก่|ข้าวกระเพราไก่/, menuName: "ข้าวกะเพราไก่", kcal: 600, carb: 75, protein: 30, fat: 20 },
  { pattern: /ข้าวกะเพราหมูไข่ดาว|ข้าวกระเพราหมูไข่ดาว/, menuName: "ข้าวกะเพราหมูไข่ดาว", kcal: 820, carb: 80, protein: 34, fat: 38 },
  { pattern: /ข้าวกะเพราหมู|ข้าวกระเพราหมู/, menuName: "ข้าวกะเพราหมู", kcal: 650, carb: 75, protein: 28, fat: 28 },
  { pattern: /ข้าวกะเพราเนื้อไข่ดาว|ข้าวกระเพราเนื้อไข่ดาว/, menuName: "ข้าวกะเพราเนื้อไข่ดาว", kcal: 850, carb: 80, protein: 38, fat: 38 },
  { pattern: /ข้าวกะเพราเนื้อ|ข้าวกระเพราเนื้อ/, menuName: "ข้าวกะเพราเนื้อ", kcal: 700, carb: 75, protein: 34, fat: 30 },
  { pattern: /ข้าวหมูกระเทียม/, menuName: "ข้าวหมูกระเทียม", kcal: 700, carb: 80, protein: 32, fat: 28 },
  { pattern: /ข้าวหมูทอด/, menuName: "ข้าวหมูทอด", kcal: 750, carb: 85, protein: 30, fat: 34 },
  { pattern: /หมูสันนอกทอด|สันนอกทอด/, menuName: "หมูสันนอกทอด", kcal: 360, carb: 15, protein: 32, fat: 20 },
  { pattern: /หมูสันนอกย่าง|สันนอกย่าง|หมูสันนอก/, menuName: "หมูสันนอกย่าง", kcal: 220, carb: 0, protein: 32, fat: 10 },
  { pattern: /คอหมูย่าง|หมูสันคอย่าง|สันคอย่าง|หมูสันคอ/, menuName: "คอหมูย่าง", kcal: 420, carb: 5, protein: 28, fat: 32 },
  { pattern: /หมูสามชั้นทอด|สามชั้นทอด/, menuName: "หมูสามชั้นทอด", kcal: 600, carb: 10, protein: 22, fat: 55 },
  { pattern: /หมูสามชั้นย่าง|สามชั้นย่าง|หมูสามชั้น/, menuName: "หมูสามชั้นย่าง", kcal: 520, carb: 3, protein: 22, fat: 48 },
  { pattern: /หมูทอด/, menuName: "หมูทอด", kcal: 450, carb: 15, protein: 28, fat: 30 },
  { pattern: /หมูย่าง/, menuName: "หมูย่าง", kcal: 350, carb: 5, protein: 30, fat: 22 },
  { pattern: /หมูกระทะ|หมูทะ/, menuName: "หมูกระทะ", kcal: 900, carb: 70, protein: 45, fat: 50 },
  { pattern: /ข้าวขาหมู/, menuName: "ข้าวขาหมู", kcal: 800, carb: 85, protein: 36, fat: 35, special: "porkLegRice" },
  { pattern: /เนื้อย่าง/, menuName: "เนื้อย่าง", kcal: 350, carb: 0, protein: 38, fat: 22 },
  { pattern: /ชาบู/, menuName: "ชาบู", kcal: 650, carb: 45, protein: 45, fat: 32 },
  { pattern: /ปลาแซลมอนย่าง|แซลมอนย่าง/, menuName: "แซลมอนย่าง", kcal: 330, carb: 0, protein: 32, fat: 22 },
  { pattern: /ปลากะพงทอดน้ำปลา|ปลาทอดน้ำปลา/, menuName: "ปลากะพงทอดน้ำปลา", kcal: 650, carb: 25, protein: 45, fat: 42 },
  { pattern: /ปลาทอด/, menuName: "ปลาทอด", kcal: 420, carb: 15, protein: 35, fat: 26 },
  { pattern: /ปลาเผา/, menuName: "ปลาเผา", kcal: 250, carb: 0, protein: 42, fat: 8 },
  { pattern: /ปลาย่าง/, menuName: "ปลาย่าง", kcal: 220, carb: 0, protein: 38, fat: 7 },
  { pattern: /ทูน่า/, menuName: "ทูน่า", kcal: 160, carb: 0, protein: 35, fat: 2 },
  { pattern: /กุ้งทอด/, menuName: "กุ้งทอด", kcal: 330, carb: 20, protein: 28, fat: 16 },
  { pattern: /กุ้งต้ม|กุ้งลวก/, menuName: "กุ้งต้ม", kcal: 180, carb: 0, protein: 36, fat: 3 },
  { pattern: /ก๋วยเตี๋ยวต้มยำ/, menuName: "ก๋วยเตี๋ยวต้มยำ", kcal: 450, carb: 60, protein: 22, fat: 15 },
  { pattern: /ก๋วยเตี๋ยวแห้ง/, menuName: "ก๋วยเตี๋ยวแห้ง", kcal: 500, carb: 70, protein: 22, fat: 16 },
  { pattern: /ก๋วยเตี๋ยวน้ำ|ก๋วยเตี๋ยว/, menuName: "ก๋วยเตี๋ยวน้ำ", kcal: 400, carb: 55, protein: 22, fat: 10 },
  { pattern: /บะหมี่เกี๊ยว/, menuName: "บะหมี่เกี๊ยว", kcal: 500, carb: 65, protein: 24, fat: 16 },
  { pattern: /ราเมง/, menuName: "ราเมง", kcal: 650, carb: 80, protein: 28, fat: 25 },
  { pattern: /ผัดไทย/, menuName: "ผัดไทย", kcal: 650, carb: 85, protein: 22, fat: 25 },
  { pattern: /ผัดซีอิ๊ว/, menuName: "ผัดซีอิ๊ว", kcal: 700, carb: 90, protein: 25, fat: 28 },
  { pattern: /ราดหน้า/, menuName: "ราดหน้า", kcal: 550, carb: 75, protein: 25, fat: 16 },
  { pattern: /สุกี้แห้ง/, menuName: "สุกี้แห้ง", kcal: 500, carb: 45, protein: 30, fat: 22 },
  { pattern: /สุกี้น้ำ|สุกี้/, menuName: "สุกี้น้ำ", kcal: 350, carb: 35, protein: 28, fat: 10 },
  { pattern: /ไข่เจียว/, menuName: "ไข่เจียว", kcal: 250, carb: 2, protein: 12, fat: 22 },
  { pattern: /ไข่ดาว/, menuName: "ไข่ดาว", kcal: 180, carb: 1, protein: 7, fat: 16 },
  { pattern: /ไข่ต้ม/, menuName: "ไข่ต้ม", kcal: 70, carb: 0.6, protein: 6.3, fat: 5.2 },
  { pattern: /ไข่ลวก/, menuName: "ไข่ลวก", kcal: 70, carb: 0.6, protein: 6.3, fat: 5.2 },
  { pattern: /ส้มตำ/, menuName: "ส้มตำ", kcal: 150, carb: 30, protein: 5, fat: 2, sugar: 12 },
  { pattern: /ยำวุ้นเส้น/, menuName: "ยำวุ้นเส้น", kcal: 280, carb: 42, protein: 18, fat: 6, sugar: 8 },
  { pattern: /ลาบหมู/, menuName: "ลาบหมู", kcal: 300, carb: 12, protein: 28, fat: 16 },
  { pattern: /สลัดอกไก่/, menuName: "สลัดอกไก่", kcal: 320, carb: 20, protein: 35, fat: 12 },
  { pattern: /สลัด/, menuName: "สลัด", kcal: 220, carb: 20, protein: 8, fat: 12 },
].sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(b.pattern).length - String(a.pattern).length);

const applyPorkLegRiceModifiers = (base, value) => {
  if (/(เนื้อล้วน|ล้วน|ไม่เอาหนัง|ไม่หนัง|ไม่มัน|เอาแต่เนื้อ)/.test(value)) return { ...base, kcal: 700, carb: 82, protein: 40, fat: 22, menuName: "ข้าวขาหมูเนื้อล้วน" };
  if (/(คากิ|ขากิ)/.test(value)) return { ...base, kcal: 930, carb: 82, protein: 32, fat: 55, menuName: "ข้าวขาหมูคากิ" };
  if (/(เนื้อหนัง|หนัง|ติดหนัง|ติดมัน)/.test(value)) return { ...base, kcal: 850, carb: 85, protein: 36, fat: 45, menuName: "ข้าวขาหมูเนื้อหนัง" };
  return base;
};

const applyModifiers = (meal, text) => {
  const value = compactText(text);
  let next = { ...meal };
  if (next.special === "porkLegRice") next = applyPorkLegRiceModifiers(next, value);
  delete next.special;
  const hasRiceBase = /^ข้าว/.test(next.menuName);
  if (/(พิเศษ|จัมโบ้|ไซซ์ใหญ่|sizeใหญ่)/.test(value)) next = { ...next, kcal: round(next.kcal * 1.22), carb: round(next.carb * 1.15), protein: round(next.protein * 1.18), fat: round(next.fat * 1.18), menuName: /พิเศษ/.test(next.menuName) ? next.menuName : `${next.menuName}พิเศษ` };
  if (/(ข้าวน้อย|ข้าวครึ่ง|ครึ่งข้าว|ลดข้าว|ข้าวนิดเดียว|ข้าวน้อยๆ|ข้าวน้อยนิด|ไม่เอาข้าว|ไม่ใส่ข้าว)/.test(value) && hasRiceBase) next = { ...next, kcal: clamp(next.kcal - 120), carb: clamp(next.carb - 28), protein: clamp(next.protein - 2), menuName: appendMenuNote(next.menuName, "ข้าวน้อย") };
  if (/เพิ่มข้าว|ข้าวเพิ่ม|เอาข้าวเพิ่ม|ข้าวเยอะ/.test(value) && hasRiceBase) next = { ...next, kcal: next.kcal + 180, carb: next.carb + 40, protein: next.protein + 3, menuName: appendMenuNote(next.menuName, "เพิ่มข้าว") };
  if (/ไข่ดาว/.test(value) && !/ไข่ดาว/.test(next.menuName)) next = { ...next, kcal: next.kcal + 180, carb: next.carb + 1, protein: next.protein + 7, fat: next.fat + 16, menuName: `${next.menuName}ไข่ดาว` };
  if (/ไข่ต้ม|ไข่ลวก/.test(value) && !/ไข่ต้ม|ไข่ลวก/.test(next.menuName)) next = addBoiledEggModifier(next, /ไข่ลวก/.test(value) ? "ไข่ลวก" : "ไข่ต้ม", parseEggCount(value));
  return next;
};

export const resolveLocalFoodEstimate = (text = "") => {
  const normalized = normalizeText(text);
  const value = compactText(text);
  if (!normalized || !value) return null;
  const eggEstimate = resolveBoiledEggEstimate(text);
  if (eggEstimate) return eggEstimate;
  const porkSkewerEstimate = resolvePorkSkewerEstimate(text);
  if (porkSkewerEstimate) return porkSkewerEstimate;
  const preset = PRESETS.find((entry) => entry.pattern.test(value) || entry.pattern.test(normalized));
  if (!preset) return null;
  const meal = withDefaults(applyModifiers(preset, text));
  return { ...meal, items: [makeItem(meal, /พิเศษ|เพิ่มข้าว|ข้าวน้อย|ไข่ต้ม|ไข่ลวก/.test(value) ? "1 เสิร์ฟปรับตามที่สั่ง" : "1 เสิร์ฟ")] };
};

export const LOCAL_FOOD_ESTIMATE_COUNT = PRESETS.length;
