const baseBubble = ({ altText, eyebrow, title, subtitle, boxTitle, boxText, footer, accent = "#D97706" }) => ({
  type: "flex",
  altText,
  contents: {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FFF7ED",
      paddingAll: "16px",
      contents: [
        { type: "text", text: eyebrow, size: "xs", weight: "bold", color: accent, wrap: true },
        { type: "text", text: title, size: "xl", weight: "bold", color: "#1F2937", wrap: true, margin: "xs" },
        { type: "text", text: subtitle, size: "sm", color: "#7C2D12", wrap: true, margin: "sm" },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#FFFFFF",
          cornerRadius: "16px",
          paddingAll: "14px",
          margin: "md",
          spacing: "sm",
          contents: [
            { type: "text", text: boxTitle, size: "sm", weight: "bold", color: "#1F2937", wrap: true },
            { type: "text", text: boxText, size: "sm", color: "#7C2D12", wrap: true },
          ],
        },
        { type: "text", text: footer, size: "sm", color: "#003C88", weight: "bold", wrap: true, align: "center", margin: "md" },
      ],
    },
  },
});

export const buildSetGoalFlexMessage = () => baseBubble({
  altText: "ตั้งเป้าหมาย",
  eyebrow: "🎯 โหมดตั้งเป้า",
  title: "เอาเป้ามา เดี๋ยวแปะจำให้",
  subtitle: "ไม่ต้องเขียนสวยมาก พิมพ์แบบคนจริง ๆ ได้เลย",
  boxTitle: "ลองพิมพ์ประมาณนี้",
  boxText: "• อยากลดไขมันแบบไม่เครียด\n• อยากคุมน้ำหนักก่อนสงกรานต์\n• อยากกินดีขึ้น แต่ยังขอกินอร่อยอยู่",
  footer: "เป้าไม่ต้องโหด แค่ทำต่อได้ก็พอ 😄",
});

export const buildEditMealFlexMessage = () => baseBubble({
  altText: "แก้มื้อล่าสุด",
  eyebrow: "🧾 แก้มื้อเมื่อกี้",
  title: "เมื่อกี้แปะจดเพี้ยนใช่มั้ย",
  subtitle: "ไม่เป็นไร พิมพ์แก้มา เดี๋ยวแปะจัดให้ใหม่",
  boxTitle: "พิมพ์แบบนี้ได้เลย",
  boxText: "• แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว\n• แก้เป็น 650 kcal\n• ลบมื้อล่าสุด",
  footer: "แปะไม่ดื้อ แก้ได้ 😅",
});

export const buildDeleteMealFlexMessage = ({ deleted = {}, notFound = false } = {}) => {
  const total = deleted.todayCalories ?? deleted.totalToday ?? 0;
  const target = deleted.calorieTarget || 2050;

  return baseBubble({
    altText: notFound ? "ยังไม่มีมื้อให้ลบ" : "ลบมื้อล่าสุดแล้ว",
    eyebrow: notFound ? "👀 แปะหาแล้วนะ" : "🗑️ ลบให้แล้ว",
    title: notFound ? "ยังไม่มีมื้อให้ลบนะ" : "โอเค มื้อนั้นหายไปแล้ว",
    subtitle: notFound
      ? "ระบบยังไม่เจอมื้อล่าสุดของวันนี้ ส่งรูปหรือพิมพ์อาหารมาก่อนนะ"
      : `ลบ: ${deleted.deletedMeal?.menuName || "มื้อล่าสุด"}`,
    boxTitle: notFound ? "เริ่มใหม่ได้เลย" : "ยอดหลังลบ",
    boxText: notFound ? "ส่งรูปอาหารมา เดี๋ยวแปะนับให้ 👀" : `${Math.round(total)} / ${Math.round(target)} kcal`,
    footer: notFound ? "ยังทันอยู่ ไม่ต้องตกใจ 😄" : "ลบแล้วก็เริ่มคุมต่อได้ ชิล ๆ",
  });
};
