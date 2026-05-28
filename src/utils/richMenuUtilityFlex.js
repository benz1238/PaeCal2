const baseBubble = ({ altText, title, subtitle, boxTitle, boxText, accent = "#003C88" }) => ({
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
        { type: "text", text: title, size: "xl", weight: "bold", color: "#1F2937", wrap: true },
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
            { type: "text", text: boxTitle, size: "sm", weight: "bold", color: "#1F2937" },
            { type: "text", text: boxText, size: "sm", color: accent, weight: "bold", wrap: true },
          ],
        },
      ],
    },
  },
});

export const buildSetGoalFlexMessage = () => baseBubble({
  altText: "ตั้งเป้าหมาย",
  title: "🎯 ตั้งเป้าหมาย",
  subtitle: "พิมพ์เป้าหมายมาได้เลย แปะจะจำไว้ให้",
  boxTitle: "ตัวอย่าง",
  boxText: "• อยากลดไขมัน\n• อยากคุมน้ำหนัก\n• อยากกินสุขภาพดีขึ้น",
});

export const buildEditMealFlexMessage = () => baseBubble({
  altText: "แก้มื้อล่าสุด",
  title: "🧾 แก้มื้อล่าสุด",
  subtitle: "พิมพ์แก้ตามนี้ได้เลย เดี๋ยวแปะจัดให้",
  boxTitle: "ตัวอย่าง",
  boxText: "• แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว\n• แก้เป็น 650 kcal\n• ลบมื้อล่าสุด",
});

export const buildDeleteMealFlexMessage = ({ deleted = {}, notFound = false } = {}) => {
  const total = deleted.todayCalories ?? deleted.totalToday ?? 0;
  const target = deleted.calorieTarget || 2050;

  return baseBubble({
    altText: notFound ? "ยังไม่มีมื้อให้ลบ" : "ลบมื้อล่าสุดแล้ว",
    title: notFound ? "ยังไม่มีมื้อให้ลบ 😅" : "ลบมื้อล่าสุดแล้ว 🗑️",
    subtitle: notFound
      ? "แปะยังไม่เจอมื้อล่าสุดในระบบ ส่งรูปอาหารมาก่อน แล้วค่อยลบได้จ้า"
      : `ลบ: ${deleted.deletedMeal?.menuName || "มื้อล่าสุด"}`,
    boxTitle: notFound ? "เริ่มบันทึกได้เลย" : "ยอดหลังลบ",
    boxText: notFound ? "ส่งรูปอาหารมา เดี๋ยวแปะนับให้" : `${Math.round(total)} / ${Math.round(target)} kcal`,
  });
};
