const RARITY_META = {
  Common: { emoji: "⚪", color: "#6B7280", weight: 52 },
  Rare: { emoji: "🔵", color: "#2563EB", weight: 26 },
  Epic: { emoji: "🟣", color: "#7C3AED", weight: 13 },
  Legendary: { emoji: "🟠", color: "#EA580C", weight: 6 },
  Mythic: { emoji: "🔴", color: "#DC2626", weight: 2 },
  Secret: { emoji: "⚫", color: "#111827", weight: 1 },
};

const title = (name, rarity = "Common", vibe = "") => ({
  name,
  rarity,
  emoji: RARITY_META[rarity]?.emoji || "⚪",
  color: RARITY_META[rarity]?.color || "#6B7280",
  vibe,
});

const TITLE_BANK = {
  sweet: [
    title("เจ้าหญิงน้ำตาล", "Common", "หวานนำ ชีวิตตาม"),
    title("Blood Type: Brown Sugar", "Rare", "เลือดกรุ๊ปชาไทย"),
    title("หวานนำ ชีวิตตาม", "Common", "ของหวานมีซีนทุกมื้อ"),
    title("น้ำตาลเรียกพี่", "Rare", "ไม่หวานมาก แค่หวานก่อน"),
    title("ลูกหลานชาตรามือ", "Epic", "ชาไทยคือพยาน"),
    title("Dessert Main Character", "Epic", "ของหวานไม่ใช่ side quest"),
    title("ชีวิตติดไซรัป 🚨", "Rare", "หวานจนแปะต้องเหล่"),
    title("Sweet Tooth Lv.99", "Epic", "สกิลหวานเต็มหลอด"),
    title("ชาไทยมาก่อน เบาหวานยังไม่มา", "Legendary", "แปะไม่ได้ดุ แปะแค่เห็น"),
    title("วิญญาณของหวานสิงร่าง", "Epic", "วันนี้ dessert มีบท"),
    title("Caramel Core", "Rare", "มู้ดละมุนแต่น้ำตาลชัด"),
    title("Cream Overload Aura", "Epic", "นัวแบบไม่ถามแคล"),
    title("Sugar God", "Mythic", "หวานระดับปลดล็อก"),
  ],
  fried: [
    title("เทพแห่งของทอด", "Common", "กรอบก่อน ค่อยคิดทีหลัง"),
    title("น้ำมันคือพลังงานชีวิต", "Rare", "วันนี้ทอดมีซีน"),
    title("Fried Chicken Energy", "Rare", "พลังกรอบล้นตัว"),
    title("กรอบไว้ก่อน แปะค่อยว่า", "Common", "จังหวะนี้ขอกรอบ"),
    title("นักสะสมชีส", "Rare", "ชีสมา ไขมันยิ้ม"),
    title("ไขมันไม่เข้าใครออกใคร", "Common", "มันแบบมีหลักฐาน"),
    title("ชีสเยิ้ม Enjoyer", "Epic", "เยิ้มจนแปะเงียบไปแป๊บ"),
    title("Deep Fried Soul", "Epic", "วิญญาณหม้อทอดเรียกหา"),
    title("Crunchy Lifestyle", "Rare", "กรอบคือภาษาใจ"),
    title("นักบวชแห่งหม้อทอด", "Legendary", "ศรัทธาในความกรอบ"),
    title("Oil Era Activated", "Epic", "ยุคน้ำมันเริ่มแล้ว"),
  ],
  carb: [
    title("แป้งสามจาน", "Common", "คาร์บมาแบบไม่หลบ"),
    title("เส้นคือนิพพาน", "Rare", "เห็นเส้นแล้วใจสงบ"),
    title("Rice Dominator", "Rare", "ข้าวคือ main plot"),
    title("คาร์บไม่เคยทำร้ายใคร", "Common", "แปะฟังแล้วแปะยิ้ม"),
    title("Carb Loading ตลอดชีพ", "Epic", "โหลดคาร์บเหมือนมีแข่งพรุ่งนี้"),
    title("ลูกหลานแป้ง", "Rare", "สายเลือดคาร์บชัดเจน"),
    title("เส้นนำทางชีวิต", "Common", "มื้อไหนมีเส้น มื้อนั้นมีหวัง"),
    title("ข้าวหมด = ใจหาย", "Rare", "นี่แหละความจริงของชีวิต"),
    title("แป้งก่อน โปรตีนทีหลัง", "Common", "ลำดับชีวิตชัดมาก"),
    title("Noodle Energy สูงมาก", "Epic", "พลังเส้นขึ้นกราฟ"),
    title("Carb Emperor", "Legendary", "จักรวรรดิแป้งกำลังมา"),
  ],
  lowProtein: [
    title("โปรตีนหายเข้ากลีบเมฆ", "Common", "แปะหาแล้ว ยังไม่เจอ"),
    title("กล้ามร้องไห้เบา ๆ", "Rare", "ไม่ดราม่า แต่กล้ามมีน้ำตา"),
    title("ตามหาอกไก่ไม่เจอ", "Common", "ภารกิจยังไม่สำเร็จ"),
    title("Protein DLC ยังไม่โหลด", "Epic", "ต้องซื้อแพ็กโปรตีนเพิ่มแล้วมั้ง"),
    title("ร่างกายถามหาเนื้อสัตว์", "Rare", "โปรตีนขอ screen time"),
    title("โปรตีนน้อยแต่น่ารัก", "Common", "น่ารักจริง แต่แปะขอเพิ่มนิด"),
    title("Chicken Breast Left the Chat", "Epic", "อกไก่ออกจากห้องไปแล้ว"),
    title("โปรตีนหลบอยู่ไหน", "Common", "แปะกำลังตามหา"),
    title("Carb Solo Player", "Rare", "คาร์บเล่นเดี่ยวทั้งเกม"),
  ],
  proteinGood: [
    title("ลูกพี่เวย์โปรตีน", "Rare", "โปรตีนมาแบบมีบารมี"),
    title("Protein Maxxing", "Epic", "สายฟิตเริ่มออกอาการ"),
    title("กล้ามพร้อมโต", "Common", "ร่างกายพยักหน้าแล้ว"),
    title("Clean Bulk Aura", "Epic", "ทรงนี้ฟิตแบบไม่ฝืน"),
    title("โปรตีนถึง แปะถึงใจ", "Rare", "แปะภูมิใจเบา ๆ"),
    title("อกไก่คือเพื่อนแท้", "Common", "เพื่อนที่ไม่หักหลัง"),
    title("กินเหมือนคนจะฟิตจริง", "Rare", "แปะเริ่มเชื่อแล้วนะ"),
    title("Macro Respecter", "Epic", "เคารพมาโครแบบคนมีวินัย"),
    title("Lean Machine", "Legendary", "ทรงเริ่มคม"),
    title("ผู้ถูกเลือกแห่งอกไก่", "Mythic", "อกไก่เลือกแล้ว"),
  ],
  lowCal: [
    title("ร่างทองสายคุม", "Rare", "วันนี้นิ่งจัด"),
    title("Minimal Calorie Lifestyle", "Epic", "แคลน้อยแต่ทรงดี"),
    title("แคลน้อยแต่อยู่รอด", "Common", "เบาแต่ไม่ล้ม"),
    title("Discipline Aura", "Epic", "วินัยออกแสง"),
    title("เทพแห่ง Portion Control", "Legendary", "ตักพอดีเหมือนมีสติ"),
    title("คุมจนแปะตกใจ", "Rare", "แปะเช็กซ้ำแล้วจริง"),
    title("สายเบาแต่เอาอยู่", "Common", "ไม่เยอะ แต่รอด"),
    title("Calorie Ninja", "Epic", "แคลเงียบ แต่คุมอยู่"),
    title("Silent Deficit", "Rare", "ไม่พูดเยอะ แต่น้ำหนักรู้เรื่อง"),
    title("ร่างทองแห่งการคุม", "Mythic", "วันนี้ของจริง"),
  ],
  lateNight: [
    title("Midnight Munchies", "Rare", "ดึกแล้วแต่เกมยังไม่จบ"),
    title("ตีหนึ่งยังเปิดตู้เย็น", "Common", "ตู้เย็นคือเพื่อนยามดึก"),
    title("Night Shift Eater", "Rare", "ท้องเข้าเวรกลางคืน"),
    title("ดึกแล้วแต่หิวอะ", "Common", "เหตุผลสั้น แต่จริง"),
    title("มาม่าตอนเที่ยงคืน Ambassador", "Epic", "ตำแหน่งนี้ไม่ใช่ใครก็ได้"),
    title("Late Night Core", "Rare", "มู้ดดึกชัดมาก"),
    title("ท้องทำ OT", "Common", "แปะขอให้ท้องพักบ้าง"),
    title("หิวตอนคนอื่นนอน", "Common", "ชีวิตกลางคืนเวอร์"),
    title("Midnight Carb Attack", "Epic", "คาร์บโจมตีตอนดึก"),
    title("ดาวเด่นแห่ง 7-Eleven", "Legendary", "ไฟเซเว่นคือสปอร์ตไลต์"),
  ],
  over: [
    title("วันนี้ใจใหญ่", "Common", "ใจถึง แคลก็ถึง"),
    title("แคลทะลุจักรวาล", "Epic", "ตัวเลขขึ้นยานแล้ว"),
    title("Bulk แบบไม่ได้นัด", "Rare", "ร่างกายงง แต่แปะเข้าใจ"),
    title("Cheat Day Survivor", "Epic", "รอดมาได้ก็นับว่าเก่ง"),
    title("Enjoy Life Specialist", "Rare", "ชีวิตต้องมีรสชาติ"),
    title("หลุดแบบมีคุณภาพ", "Common", "อย่างน้อยก็อร่อย"),
    title("Full Course Main Character", "Epic", "มื้อนี้เป็นพระเอก"),
    title("Calories Fear Me", "Legendary", "แคลเห็นแล้วยังถอย"),
    title("อิ่มจนวิญญาณแน่น", "Rare", "แปะอ่านแล้วแน่นแทน"),
    title("Buffet Energy", "Epic", "พลังบุฟเฟต์เข้าสิง"),
  ],
  balanced: [
    title("สมดุลเกินมนุษย์", "Epic", "แปะเริ่มสงสัยว่าซ้อมมา"),
    title("Aura คนดูแลตัวเอง", "Rare", "ดูแลตัวเองแบบไม่เว่อร์"),
    title("Healthy แต่ยังอร่อย", "Common", "อันนี้แหละทางสายกลาง"),
    title("Balanced Lifestyle Holder", "Epic", "ถือสมดุลไว้แน่น"),
    title("แปะภูมิใจในตัวลื้อ", "Rare", "พูดจริง ไม่ได้อวย"),
    title("Rare Clean Day", "Epic", "วันนี้สะอาดแบบน่าสงสัย"),
    title("คุมแบบคนมีประสบการณ์", "Common", "ไม่ตึง แต่ไม่หลุด"),
    title("Soft Discipline", "Rare", "วินัยแบบไม่ทำร้ายใจ"),
    title("Zen of Eating", "Legendary", "นิ่งจนแปะงง"),
    title("Legendary Clean Day", "Mythic", "วันนี้สะอาดระดับตำนาน"),
  ],
  comfort: [
    title("ฮีลใจด้วยของกิน", "Common", "วันนี้อาหารทำหน้าที่ปลอบใจ"),
    title("Emotional Support Meal", "Rare", "มื้อนี้ไม่ใช่อาหาร มันคือกำลังใจ"),
    title("นักบำบัดด้วยชาไทย", "Epic", "ชาไทยเข้ามารับบทนักจิตวิทยา"),
    title("Comfort Food Main", "Rare", "ขอกินก่อน ค่อยสู้ต่อ"),
    title("วันนี้ขออร่อยก่อน", "Common", "แปะเข้าใจ แต่อย่าบ่อยมาก"),
    title("กินเอาใจรอด", "Common", "วันนี้รอดด้วยอาหาร"),
    title("น้ำหวานช่วยชีวิต", "Rare", "หวานนี้มีเหตุผล"),
    title("Soul Recovery Mode", "Epic", "กำลังชาร์จใจผ่านมื้ออาหาร"),
    title("หมูกระทะเยียวยาทุกสิ่ง", "Legendary", "เรื่องหนักแค่ไหน หมูกระทะรับจบ"),
    title("เหนื่อยแหละ ดูออก", "Rare", "อาหารฟ้องแทนปากแล้ว"),
  ],
  rare: [
    title("Rare Human Being", "Legendary", "สมดุลแบบคนหายาก"),
    title("สมดุลจนแปะงง", "Legendary", "แปะดูแล้วต้องดูอีกที"),
    title("แคลถึง โปรตีนถึง ชีวิตถึง", "Mythic", "ครบเครื่องเกินคาด"),
    title("Macro Wizard", "Mythic", "มาโครเหมือนเสกมา"),
    title("The Chosen Meal", "Secret", "มื้อนี้ถูกเลือกแล้ว"),
    title("ร่างทองแห่งการคุม", "Mythic", "วันนี้ล็อกอินร่างทอง"),
  ],
};

const stableHash = (value = "") => {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pickBySeed = (items = [], seed = "") => {
  if (!items.length) return title("ยังไม่มีหลักฐาน 👀", "Common", "ส่งรูปมาก่อน เดี๋ยวแปะตั้งให้");
  return items[stableHash(seed) % items.length];
};

const getBangkokHour = () => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value || 12);
  } catch {
    return 12;
  }
};

export const selectDailyTitle = (signals = {}, context = {}) => {
  if (signals.isEmpty) return title("ยังไม่มีหลักฐาน 👀", "Common", "ส่งรูปมาก่อน เดี๋ยวแปะอ่านทรงให้");

  const hour = getBangkokHour();
  const pools = [];

  if (signals.isOver) pools.push("over");
  if (signals.sweetSignal) pools.push("sweet");
  if (signals.highFat) pools.push("fried");
  if (signals.highCarb) pools.push("carb");
  if (signals.lowProtein) pools.push("lowProtein");
  if (signals.protein >= 75) pools.push("proteinGood");
  if (signals.kcal > 0 && signals.kcal <= Math.max(900, signals.target * 0.55)) pools.push("lowCal");
  if (hour >= 21 || hour < 3) pools.push("lateNight");
  if (!signals.isOver && !signals.lowProtein && !signals.highFat && !signals.sweetSignal) pools.push("balanced");
  if (signals.sweetSignal || signals.highCarb || /ชา|หวาน|หมูกระทะ|ขนม|เค้ก|กะเพรา|ผัด|ทอด/i.test(context.topMeal || "")) pools.push("comfort");

  if (!pools.length) pools.push("balanced");

  const rareChanceSeed = stableHash(`${context.userId || ""}:${context.date || ""}:${signals.kcal}:${signals.topMeal || ""}`) % 100;
  if (rareChanceSeed >= 94) pools.push("rare");

  const mainPool = pools[stableHash(`${signals.kcal}:${signals.carb}:${signals.protein}:${signals.fat}:${signals.sugar}:${signals.topMeal}`) % pools.length];
  const candidates = TITLE_BANK[mainPool] || TITLE_BANK.balanced;
  const chosen = pickBySeed(candidates, `${context.userId || "paecal"}:${context.date || "today"}:${mainPool}:${signals.topMeal}:${signals.kcal}`);

  return { ...chosen, category: mainPool };
};

export const getRarityLabel = (rarity = "Common") => `${RARITY_META[rarity]?.emoji || "⚪"} ${rarity}`;
