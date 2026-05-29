import { chooseDailyRecapStickerUrl } from "./paeStickerAssets.js";

const palette = {
  cream: '#FFF7EF',
  card: '#FFFFFF',
  border: '#EAD6C8',
  red: '#D93A2F',
  redDark: '#9F2F25',
  green: '#0F7A55',
  gold: '#F4D48A',
  goldLight: '#F9E5AF',
  lightBlue: '#D4E8F0',
  lightGreen: '#D4F0E8',
  text: '#242B33',
  muted: '#667085',
  brown: '#6A342C',
  orange: '#D97706',
};

const DEFAULT_CALORIE_TARGET = 2050;

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalize = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const truncate = (value, max = 28) => {
  const text = normalize(value, '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const stickerImage = ({ url = '', size = '72px' } = {}) => url ? ({
  type: 'image',
  url,
  size,
  aspectMode: 'fit',
  aspectRatio: '1:1',
  gravity: 'center',
}) : ({ type: 'text', text: '👀', size: 'xxl', align: 'center' });

const heroTitleBlock = ({ name, personaTitle, characterUrl = '' }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '10px',
  margin: 'none',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '4px',
      contents: [
        { type: 'text', text: 'TODAY RECAP', size: 'xs', weight: 'bold', color: palette.redDark, maxLines: 1 },
        { type: 'text', text: `ของ ${truncate(name, 16)}`, size: 'sm', weight: 'bold', color: palette.muted, maxLines: 1 },
        { type: 'text', text: personaTitle, size: 'xl', weight: 'bold', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 0,
      width: '78px',
      height: '78px',
      contents: [stickerImage({ url: characterUrl, size: '78px' })],
    },
  ],
});

const insightBox = ({ insight, stickerUrl = '' }) => ({
  type: 'box',
  layout: 'horizontal',
  backgroundColor: palette.gold,
  cornerRadius: '16px',
  paddingAll: '12px',
  spacing: '8px',
  margin: 'md',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 0,
      width: '46px',
      height: '46px',
      contents: [stickerImage({ url: stickerUrl, size: '46px' })],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '4px',
      contents: [
        { type: 'text', text: 'วันนี้อาหารฟ้องว่า', size: 'sm', weight: 'bold', color: palette.text },
        { type: 'text', text: insight, size: 'sm', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
  ],
});

const statsCard = ({ eaten, target, carb, protein, fat, sugar, mealCount }) => {
  const over = Math.max(eaten - target, 0);
  const left = Math.max(target - eaten, 0);
  let statusText = `เหลือ ${Math.round(left)} kcal อยู่`;
  let statusColor = palette.green;
  if (eaten <= 0) {
    statusText = 'วันนี้ยังไม่มีมื้อที่บันทึก';
    statusColor = palette.muted;
  } else if (over > 0) {
    statusText = `วันนี้เกินเป้าแล้วนิดนึงนะ`;
    statusColor = palette.red;
  } else if (left <= 250) {
    statusText = `เหลือ ${Math.round(left)} kcal ใกล้เต็ม`;
    statusColor = palette.orange;
  }

  const row = (label, value, color = palette.text) => ({
    type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: label, size: 'sm', color: palette.muted, flex: 4 },
      { type: 'text', text: value, size: 'sm', weight: 'bold', color, align: 'end', flex: 6 },
    ],
  });

  return {
    type: 'box', layout: 'vertical', backgroundColor: palette.card, cornerRadius: '16px', paddingAll: '12px', spacing: '8px', borderWidth: '1px', borderColor: palette.border, margin: 'md',
    contents: [
      { type: 'text', text: 'สรุปวันนี้', size: 'sm', weight: 'bold', color: palette.text },
      { type: 'text', text: statusText, size: 'md', weight: 'bold', color: statusColor, wrap: true },
      { type: 'separator', color: palette.border, margin: 'sm' },
      row('กินไป', `${Math.round(eaten)} / ${Math.round(target)} kcal`, over > 0 ? palette.red : palette.text),
      row('คาร์บ', `${Math.round(carb)} g`),
      row('โปรตีน', `${Math.round(protein)} g`, protein >= 70 ? palette.green : palette.orange),
      row('ไขมัน', `${Math.round(fat)} g`),
      row('น้ำตาล', `${Math.round(sugar)} g`),
      row('มื้อ', `${Math.round(mealCount)} มื้อ`),
    ],
  };
};

const suggestionBox = ({ goal, topMeal }) => ({
  type: 'box', layout: 'horizontal', spacing: '10px', margin: 'md', contents: [
    {
      type: 'box', layout: 'vertical', flex: 1, backgroundColor: palette.lightGreen, cornerRadius: '14px', paddingAll: '12px', spacing: '4px',
      contents: [
        { type: 'text', text: 'เป้าหมาย', size: 'sm', weight: 'bold', color: palette.text },
        { type: 'text', text: goal, size: 'xs', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
    {
      type: 'box', layout: 'vertical', flex: 1, backgroundColor: palette.lightBlue, cornerRadius: '14px', paddingAll: '12px', spacing: '4px',
      contents: [
        { type: 'text', text: 'มื้อเด่น', size: 'sm', weight: 'bold', color: palette.text },
        { type: 'text', text: topMeal, size: 'xs', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
  ],
});

const footerBox = ({ message, stickerUrl = '' }) => ({
  type: 'box', layout: 'horizontal', margin: 'md', spacing: '8px', contents: [
    { type: 'separator', color: palette.border, margin: 'sm' },
    {
      type: 'box', layout: 'horizontal', spacing: '8px', margin: 'sm', contents: [
        { type: 'box', layout: 'vertical', flex: 0, width: '42px', height: '42px', contents: [stickerImage({ url: stickerUrl, size: '42px' })] },
        { type: 'text', text: message, size: 'sm', weight: 'bold', color: palette.redDark, align: 'start', wrap: true, maxLines: 2, flex: 1 },
      ],
    },
  ],
});

const buildPersonaTitle = ({ day = {}, memory = {} }) => {
  if (memory.hasSweetPattern && (day.isOver || day.isVeryOver)) return 'หวานนำทีม';
  if (memory.hasHeavyPattern || day.isVeryOver) return 'ชีวิตติดมัน';
  if (memory.hasSweetPattern) return 'หวานมาเป็นบท';
  if (memory.hasFriedPattern) return 'ทอดบ่อยแต่ยังไหว';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนมีทรง';
  if (day.isNearLimit) return 'เกือบเต็มแต่เอาอยู่';
  return 'ยังเอาอยู่';
};

const buildInsightMessage = ({ day = {}, memory = {}, problemMeal = null }) => {
  if (memory.hasSweetPattern) return 'ใจอยากคุม แต่ของหวานมาเด่นจริง ๆ';
  if (memory.hasFriedPattern) return 'ใจอยากคุม แต่ของทอด/มันมาเด่นจริง ๆ';
  if (day.isVeryOver || memory.hasHeavyPattern) return 'ใจอยากคุม แต่วันนี้อยากกินเยอะซะแล้ว';
  if (problemMeal?.menuName) return `${truncate(problemMeal.menuName, 20)} นำทีมวันนี้`;
  return 'ทรงรวมวันนี้ยังพอไปได้';
};

const buildClosingMessage = ({ day = {}, memory = {} }) => {
  if (day.isOver || memory.hasHeavyPattern) return 'ต่อไป คุมของทอดกับน้ำหวานนิดนึง';
  if (memory.hasSweetPattern) return 'ต่อไป พักหวานสักรอบ แปะว่าเวิร์ก';
  if (memory.hasFriedPattern) return 'ต่อไป พักทอดนิดนึง แล้วไปต่อได้';
  if (day.goodProteinDay || memory.hasProteinWin) return 'ต่อไป คุมต่ออีกนิด ทรงนี้ใช้ได้';
  return 'ต่อไป คุมต่ออีกนิด';
};

export const buildDailyRecapFlexMessageNew = ({ title = 'ลื้อ', summary = {}, decision = {}, characterUrl = '' }) => {
  const day = decision.day || {};
  const memory = decision.memory || day.memory || {};
  const problemMeal = decision.problemMeal || (Array.isArray(day.meals) ? day.meals[0] : null) || null;
  const stickerUrl = characterUrl || chooseDailyRecapStickerUrl({ day, memory });

  const eaten = safeNumber(day.eaten ?? summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(day.target ?? summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const carb = safeNumber(day.carb ?? summary.totalCarb, 0);
  const protein = safeNumber(day.protein ?? summary.totalProtein, 0);
  const fat = safeNumber(day.fat ?? summary.totalFat, 0);
  const sugar = safeNumber(day.sugar ?? summary.totalSugar, 0);
  const mealCount = safeNumber(day.mealCount ?? summary.mealCount, 0);

  const personaTitle = buildPersonaTitle({ day, memory });
  const insightMessage = buildInsightMessage({ day, memory, problemMeal });
  const closingMessage = buildClosingMessage({ day, memory });
  const goalText = truncate(normalize(summary.goal || summary.healthGoal || summary.userGoal, 'ยังไม่ได้ตั้งเป้า'), 20);
  const topMealText = problemMeal?.menuName && problemMeal?.menuName !== 'ยังไม่มีมื้อเด่น'
    ? truncate(`${problemMeal.menuName}${problemMeal?.kcal ? ` · ${Math.round(problemMeal.kcal)} kcal` : ''}`, 24)
    : 'ยังไม่มีมื้อเด่น';

  return {
    type: 'flex',
    altText: `สรุปวันนี้ของ ${truncate(title, 16)}`,
    contents: {
      type: 'bubble', size: 'mega', body: {
        type: 'box', layout: 'vertical', spacing: '0px', backgroundColor: palette.cream, paddingAll: '14px', contents: [
          heroTitleBlock({ name: title, personaTitle, characterUrl: stickerUrl }),
          insightBox({ insight: insightMessage, stickerUrl }),
          statsCard({ eaten, target, carb, protein, fat, sugar, mealCount }),
          suggestionBox({ goal: goalText, topMeal: topMealText }),
          footerBox({ message: closingMessage, stickerUrl }),
        ],
      },
    },
  };
};
