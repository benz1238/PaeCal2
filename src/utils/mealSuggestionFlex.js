const MEAL_IMAGE_URLS = {
  chicken: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80",
  riceBowl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1200&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  noodle: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80",
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1200&q=80",
  yogurt: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1200&q=80",
};

const CAROUSEL_BUBBLE_SIZE = "kilo";

const getBangkokHour = () => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value || 12);
  } catch {
    return 12;
  }
};

const getTimeMood = () => {
  const hour = getBangkokHour();

  if (hour >= 5 && hour < 10) {
    return { eyebrow: "🌤️ เช้า ๆ แบบนี้", title: "เอาอะไรอุ่น ๆ อยู่ท้องก่อน", footer: "เริ่มวันแบบไม่ตีกับท้อง แปะว่าโอเค 😄" };
  }
  if (hour >= 10 && hour < 14) {
    return { eyebrow: "🍚 เที่ยงพอดี", title: "มื้อนี้เอาอิ่ม แต่ไม่ต้องมันจัด", footer: "กินให้อิ่มแบบไม่ง่วงบ่าย แปะเชียร์อันนี้ 😄" };
  }
  if (hour >= 14 && hour < 17) {
    return { eyebrow: "👀 บ่ายแล้วนะ", title: "ถ้าหิวตอนนี้ เอาแบบกันหลุดก่อน", footer: "อย่าเพิ่งเล่นใหญ่ เดี๋ยวมื้อเย็นจะต่อยาก 😅" };
  }
  if (hour >= 17 && hour < 21) {
    return { eyebrow: "🌙 เย็นแล้วจ้า", title: "มื้อนี้เอาอิ่มพอดี ไม่ลากยาว", footer: "เอาให้อิ่มพอดี ๆ คืนนี้จะได้ไม่แน่นเกิน 😄" };
  }
  return { eyebrow: "🦉 ดึกแล้วนะ", title: "ถ้ายังหิวจริง ๆ เบา ๆ ก็พอ", footer: "ดึกแล้ว ไม่ต้องเล่นใหญ่ เดี๋ยวท้องทำงานโอที 😂" };
};

const getMealOptions = () => {
  const hour = getBangkokHour();

  if (hour >= 5 && hour < 10) {
    return [
      { title: "โจ๊กหมู + ไข่", tag: "อุ่นท้อง", emoji: "🥣", desc: "อยู่ท้องกว่าแค่กาแฟ แปะว่าเริ่มวันไม่พัง", imageUrl: MEAL_IMAGE_URLS.soup },
      { title: "โยเกิร์ต + กล้วย", tag: "เบา ๆ", emoji: "🍌", desc: "รีบก็ยังพอมีทรง ไม่หนักท้องเกิน", imageUrl: MEAL_IMAGE_URLS.yogurt },
      { title: "ข้าวอกไก่ไข่ต้ม", tag: "โปรตีนมา", emoji: "💪", desc: "เช้าแบบตั้งใจ แต่ไม่ฝืนจนหน้าเครียด", imageUrl: MEAL_IMAGE_URLS.chicken },
    ];
  }
  if (hour >= 10 && hour < 14) {
    return [
      { title: "ข้าวไก่ย่าง", tag: "อิ่มพอดี", emoji: "🍗", desc: "โปรตีนมี แป้งมี ถ้าไม่ราดมันเยอะคือผ่าน", imageUrl: MEAL_IMAGE_URLS.chicken },
      { title: "ข้าวกะเพราไข่ดาว", tag: "สายจริง", emoji: "🍳", desc: "กินได้ แค่ลดน้ำมันนิดนึง อย่าให้แปะต้องเหล่ 👀", imageUrl: MEAL_IMAGE_URLS.riceBowl },
      { title: "สุกี้น้ำ", tag: "เซฟสุด", emoji: "🥬", desc: "ผักมา โปรตีนมา ทรงนี้ไม่ง่วงบ่าย", imageUrl: MEAL_IMAGE_URLS.noodle },
    ];
  }
  if (hour >= 14 && hour < 17) {
    return [
      { title: "ไข่ต้ม + ผลไม้", tag: "กันหลุด", emoji: "🥚", desc: "รองท้องดี ไม่เปิดเกมใหญ่เกิน", imageUrl: MEAL_IMAGE_URLS.yogurt },
      { title: "สลัดอกไก่", tag: "คลีนไม่เครียด", emoji: "🥗", desc: "เอาไว้ตัดเกมบ่าย แปะว่าเวิร์ก", imageUrl: MEAL_IMAGE_URLS.salad },
      { title: "ซุปใส / เกาเหลา", tag: "เบาอุ่น", emoji: "🍲", desc: "อิ่มแบบไม่ลากยาวไปมื้อเย็น", imageUrl: MEAL_IMAGE_URLS.soup },
    ];
  }
  if (hour >= 17 && hour < 21) {
    return [
      { title: "เกาเหลา + ข้าวนิด", tag: "เย็นพอดี", emoji: "🍲", desc: "อิ่มอยู่ แต่ไม่แน่นเกิน แปะโอเค", imageUrl: MEAL_IMAGE_URLS.soup },
      { title: "ข้าวปลา/ไก่ย่าง", tag: "คุมได้", emoji: "🐟", desc: "โปรตีนดี เลี่ยงของทอดหน่อยคือสวย", imageUrl: MEAL_IMAGE_URLS.chicken },
      { title: "สุกี้น้ำ", tag: "ตัวเซฟ", emoji: "🥬", desc: "มื้อเย็นที่ไม่เล่นใหญ่ แต่ยังอิ่ม", imageUrl: MEAL_IMAGE_URLS.noodle },
    ];
  }
  return [
    { title: "นมจืด / โยเกิร์ต", tag: "ดึกเบา ๆ", emoji: "🥛", desc: "ถ้าหิวจริง เอาแค่นี้พอ ไม่ต้องเปิดครัวใหญ่", imageUrl: MEAL_IMAGE_URLS.yogurt },
    { title: "ไข่ต้ม 1–2 ฟอง", tag: "โปรตีนเร็ว", emoji: "🥚", desc: "ง่าย จบ ไม่ลากยาว แปะว่าโอเค", imageUrl: MEAL_IMAGE_URLS.chicken },
    { title: "ซุปใสอุ่น ๆ", tag: "ท้องไม่โวย", emoji: "🍲", desc: "ดึกแล้วเอาเบา ๆ ให้ท้องพักบ้าง", imageUrl: MEAL_IMAGE_URLS.soup },
  ];
};

const buildIntroBubble = (mood) => ({
  type: "bubble",
  size: CAROUSEL_BUBBLE_SIZE,
  body: {
    type: "box",
    layout: "vertical",
    backgroundColor: "#FFF7ED",
    paddingAll: "18px",
    contents: [
      { type: "text", text: "🍽️ กินอะไรดี", size: "sm", weight: "bold", color: "#D97706" },
      { type: "text", text: mood.eyebrow, size: "xl", weight: "bold", color: "#1F2937", wrap: true, margin: "xs" },
      { type: "text", text: mood.title, size: "sm", color: "#7C2D12", wrap: true, margin: "sm" },
      {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        cornerRadius: "16px",
        paddingAll: "14px",
        margin: "md",
        contents: [{ type: "text", text: "แปะคัดมาให้ 3 ทาง เลื่อนดูเลย 👉", size: "sm", weight: "bold", color: "#003C88", wrap: true }],
      },
      { type: "text", text: mood.footer, size: "sm", weight: "bold", color: "#003C88", align: "center", wrap: true, margin: "md" },
    ],
  },
});

const buildMealBubble = (meal) => ({
  type: "bubble",
  size: CAROUSEL_BUBBLE_SIZE,
  hero: { type: "image", url: meal.imageUrl, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
  body: {
    type: "box",
    layout: "vertical",
    backgroundColor: "#FFFFFF",
    spacing: "sm",
    contents: [
      { type: "text", text: `${meal.emoji} ${meal.tag}`, size: "xs", weight: "bold", color: "#D97706" },
      { type: "text", text: meal.title, size: "lg", weight: "bold", color: "#1F2937", wrap: true },
      { type: "text", text: meal.desc, size: "sm", color: "#7C2D12", wrap: true },
    ],
  },
  footer: {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: [
      { type: "button", height: "sm", style: "secondary", action: { type: "message", label: "เอาอันนี้แปะ", text: `วันนี้ขอกิน ${meal.title}` } },
    ],
  },
});

export const buildMealSuggestionCarouselFlexMessage = () => {
  const mood = getTimeMood();
  const meals = getMealOptions();
  return { type: "flex", altText: "กินอะไรดี", contents: { type: "carousel", contents: [buildIntroBubble(mood), ...meals.map(buildMealBubble)] } };
};
