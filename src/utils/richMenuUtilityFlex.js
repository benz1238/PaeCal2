let utilityFooterCounter = 0;
const rotate = (items = []) => items[(utilityFooterCounter++) % Math.max(items.length, 1)] || "";

const palette = {
  cream: "#FFF7ED",
  card: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  brown: "#7C2D12",
  orange: "#D97706",
  blue: "#003C88",
  green: "#0F766E",
  red: "#DC2626",
  sky: "#E0F2FE",
  softRed: "#FEE2E2",
};

const text = (props) => ({ type: "text", ...props });

const baseBubble = ({ altText, eyebrow, title, subtitle, boxTitle, boxText, footer, accent = palette.orange, status = "default" }) => {
  const boxBg = status === "success" ? "#D9FBEF" : status === "danger" ? palette.softRed : palette.card;
  const footerColor = status === "success" ? palette.green : status === "danger" ? palette.red : palette.blue;

  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: palette.cream,
        paddingAll: "16px",
        spacing: "md",
        contents: [
          text({ text: eyebrow, size: "xs", weight: "bold", color: accent, wrap: true }),
          text({ text: title, size: "xl", weight: "bold", color: palette.text, wrap: true, maxLines: 3 }),
          text({ text: subtitle, size: "sm", color: palette.brown, wrap: true, maxLines: 4 }),
          {
            type: "box",
            layout: "vertical",
            backgroundColor: boxBg,
            cornerRadius: "18px",
            paddingAll: "14px",
            spacing: "sm",
            contents: [
              text({ text: boxTitle, size: "sm", weight: "bold", color: palette.text, wrap: true }),
              text({ text: boxText, size: "sm", color: palette.brown, wrap: true }),
            ],
          },
          text({ text: footer, size: "sm", color: footerColor, weight: "bold", wrap: true, align: "center", maxLines: 3 }),
        ],
      },
    },
  };
};

const setGoalFooter = () => rotate([
  "ตั้งเป้าแบบไม่ทรมาน เดี๋ยวแปะคุมจังหวะให้",
  "เป้าใหญ่ได้ แต่จานต้องคุยกันก่อนนะลื้อ 👀",
  "เอาเป้าที่ทำได้จริง แปะจะจำให้",
]);

const editMealFooter = () => rotate([
  "จดเพี้ยนไม่กลัว กลัวลื้อไม่บอกแปะมากกว่า 👀",
  "หลักฐานใหม่มาเมื่อไหร่ แปะแก้ให้ทันที",
  "แก้ได้ ไม่ต้องเริ่มใหม่ทั้งวัน",
]);

const deleteMealFooter = (notFound = false) => rotate(notFound ? [
  "ยังไม่มีมื้อให้ลบ แปะรอจดมื้อแรกก่อน",
  "โต๊ะยังโล่ง แปะยังไม่เจอหลักฐาน",
  "ถ้าเพิ่งจดไป รอสักแป๊บแล้วลองอีกที",
] : [
  "ลบแล้วก็ไปต่อได้ ชิล ๆ",
  "มื้อนั้นหายจากบันทึกแล้ว",
  "แปะลบให้แล้ว อย่ากดซ้ำจนแปะงงนะ 👀",
]);

export const buildSetGoalFlexMessage = () => baseBubble({
  altText: "ตั้งเป้าหมาย",
  eyebrow: "🎯 โหมดตั้งเป้า",
  title: "เอาเป้ามา เดี๋ยวแปะจำให้",
  subtitle: "พิมพ์สั้น ๆ ได้เลย แปะอ่านเป้าหมายกับแคลที่อยากตั้งให้",
  boxTitle: "ลองพิมพ์แบบนี้",
  boxText: "• เป้าหมาย คุมหวาน\n• เป้าหมาย กินดีขึ้น\n• ตั้งเป้า 1800 kcal\n• เป้าหมาย เพิ่มโปรตีน",
  footer: setGoalFooter(),
});

export const buildEditMealFlexMessage = () => baseBubble({
  altText: "แก้มื้อล่าสุด",
  eyebrow: "🧾 โหมดแก้มื้อ",
  title: "มะกี้แปะจดเพี้ยนไหม",
  subtitle: "พิมพ์สิ่งที่อยากแก้มาใหม่ แปะจะอัปเดตมื้อล่าสุดให้",
  boxTitle: "พิมพ์แบบนี้ได้เลย",
  boxText: "• แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว\n• แก้เป็น 650 kcal\n• ลบมื้อล่าสุด",
  footer: editMealFooter(),
});

export const buildDeleteMealFlexMessage = ({ deleted = {}, notFound = false } = {}) => {
  const total = deleted.todayCalories ?? deleted.totalToday ?? 0;
  const target = deleted.calorieTarget || 2050;
  const mealName = deleted.deletedMeal?.menuName || deleted.deletedMeal?.name || "มื้อล่าสุด";
  const mealKcal = deleted.deletedMeal?.kcal ? ` · ~${Math.round(deleted.deletedMeal.kcal)} kcal` : "";

  return baseBubble({
    altText: notFound ? "ยังไม่มีมื้อให้ลบ" : "ลบมื้อล่าสุดแล้ว",
    eyebrow: notFound ? "👀 แปะหาแล้ว" : "🗑️ แปะลบให้แล้ว",
    title: notFound ? "ยังไม่มีมื้อให้ลบนะ" : "โอเค ลบมื้อล่าสุดแล้ว",
    subtitle: notFound
      ? "วันนี้แปะยังไม่เจอมื้อที่จดไว้ หรือข้อมูลอาจยังไม่ซิงก์"
      : `ลบ: ${mealName}${mealKcal}`,
    boxTitle: notFound ? "ทำต่อได้แบบนี้" : "ยอดหลังลบ",
    boxText: notFound ? "ถ้าเพิ่งจดเมื่อกี้ ให้รอสักแป๊บแล้วกดใหม่ หรือพิมพ์ชื่อมื้อให้แปะจดก่อน" : `${Math.round(total)} / ${Math.round(target)} kcal`,
    footer: deleteMealFooter(notFound),
    status: notFound ? "danger" : "success",
    accent: notFound ? palette.orange : palette.green,
  });
};
