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
  title: "เอ้า! เอาเป้ามา เดี๋ยวแปะจำให้",
  subtitle: "พิมพ์แบบคนจริง ๆ ได้เลย ไม่ต้องทำพิธีใหญ่ แปะอ่านออกอยู่ 👀",
  boxTitle: "ลองพิมพ์ประมาณนี้",
  boxText: "• เป้าหมาย กินให้พอดี\n• เป้าหมาย เพิ่มแรง\n• เป้าหมาย คุมหวาน\n• เป้าหมาย กินดีขึ้นแต่ยังขออร่อย",
  footer: "ภารกิจที่ยิ่งใหญ่ มาพร้อมจานที่ใหญ่ยิ่ง 🍚",
});

export const buildEditMealFlexMessage = () => baseBubble({
  altText: "แก้มื้อล่าสุด",
  eyebrow: "🧾 โหมดแก้มื้อ",
  title: "ไอหยา~ มะกี้แปะจดเพี้ยนมั้ยนะ",
  subtitle: "ไม่เป็นไร ลื้อพิมพ์ให้อั๊วะมาใหม่ เดี๋ยวจัดให้ใหม่",
  boxTitle: "พิมพ์แบบนี้ได้เลย",
  boxText: "• แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว\n• แก้เป็น 650 kcal\n• ลบมื้อล่าสุด",
  footer: "เปาปุ้นจิ้นยังมีวันตัดสินใหม่ แปะก็แก้ให้ได้ 555",
});

export const buildDeleteMealFlexMessage = ({ deleted = {}, notFound = false } = {}) => {
  const total = deleted.todayCalories ?? deleted.totalToday ?? 0;
  const target = deleted.calorieTarget || 2050;

  return baseBubble({
    altText: notFound ? "ยังไม่มีมื้อให้ลบ" : "ลบมื้อล่าสุดแล้ว",
    eyebrow: notFound ? "👀 แปะหาแล้ว" : "🗑️ แปะลบให้แล้ว",
    title: notFound ? "เอ้า! ยังไม่มีมื้อให้ลบนะ" : "โอเค มื้อนั้นหายไปแล้ว",
    subtitle: notFound
      ? "วันนี้แปะยังไม่เจอมื้อที่จดไว้ ค่อยเริ่มใหม่ก็ได้"
      : `มื้อนั้นที่ลื้อกินไป มันได้หายไปแล้ว\nลบ: ${deleted.deletedMeal?.menuName || "มื้อล่าสุด"}`,
    boxTitle: notFound ? "เริ่มใหม่ได้เลย" : "ยอดหลังลบ",
    boxText: notFound ? "ยังโล่งอยู่ แปะรอจดมื้อแรกให้" : `${Math.round(total)} / ${Math.round(target)} kcal`,
    footer: notFound ? "ยังไม่มีคดีให้เปาปุ้นจิ้นตัดสิน 555" : "ลบแล้วก็เริ่มคุมต่อได้ ชิล ๆ",
  });
};
