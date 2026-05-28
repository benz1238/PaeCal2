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
  title: "เอ้า เอาเป้ามา เดี๋ยวแปะจำให้",
  subtitle: "ไม่ต้องเขียนหล่อมาก พิมพ์แบบคนจริง ๆ ได้เลย แปะอ่านออกอยู่ 👀",
  boxTitle: "ลองพิมพ์ประมาณนี้",
  boxText: "• อยากลดไขมันแบบไม่เครียด\n• อยากคุมน้ำหนักก่อนสงกรานต์\n• อยากกินดีขึ้น แต่ยังขอกินอร่อยอยู่",
  footer: "เป้าไม่ต้องโหด เอาแบบทำต่อได้ แปะว่าเวิร์ก 😄",
});

export const buildEditMealFlexMessage = () => baseBubble({
  altText: "แก้มื้อล่าสุด",
  eyebrow: "🧾 โหมดแก้มื้อ",
  title: "ไอหยา เมื่อกี้แปะจดเพี้ยนใช่มะ",
  subtitle: "ไม่เป็นไร ลื้อพิมพ์แก้มา เดี๋ยวแปะจัดระเบียบให้ใหม่",
  boxTitle: "พิมพ์แบบนี้ได้เลย",
  boxText: "• แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว\n• แก้เป็น 650 kcal\n• ลบมื้อล่าสุด",
  footer: "แปะไม่ดื้อ แก้ได้อยู่ 😅",
});

export const buildDeleteMealFlexMessage = ({ deleted = {}, notFound = false } = {}) => {
  const total = deleted.todayCalories ?? deleted.totalToday ?? 0;
  const target = deleted.calorieTarget || 2050;

  return baseBubble({
    altText: notFound ? "ยังไม่มีมื้อให้ลบ" : "ลบมื้อล่าสุดแล้ว",
    eyebrow: notFound ? "👀 แปะหาแล้ว" : "🗑️ แปะลบให้แล้ว",
    title: notFound ? "เอ้า ยังไม่มีมื้อให้ลบนะ" : "โอเค มื้อนั้นหายไปแล้ว",
    subtitle: notFound
      ? "วันนี้แปะยังไม่เจอมื้อที่จดไว้ ส่งรูปหรือพิมพ์อาหารมาก่อนก็ได้"
      : `ลบ: ${deleted.deletedMeal?.menuName || "มื้อล่าสุด"}`,
    boxTitle: notFound ? "เริ่มใหม่ได้เลย" : "ยอดหลังลบ",
    boxText: notFound ? "ส่งรูปอาหารมา เดี๋ยวแปะนับให้เอง 👀" : `${Math.round(total)} / ${Math.round(target)} kcal`,
    footer: notFound ? "ยังทันอยู่ ไม่ต้องตกใจอะ 😄" : "ลบแล้วก็เริ่มคุมต่อได้ ชิล ๆ",
  });
};
