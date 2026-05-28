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

/**
 * Build the main hero title section
 * "TODAY RECAP ของ [name]"
 * "[persona title]"
 * With character illustration on the right
 */
const heroTitleBlock = ({ name, personaTitle, characterUrl = '' }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '12px',
  margin: 'none',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '4px',
      contents: [
        {
          type: 'text',
          text: 'TODAY RECAP',
          size: 'xs',
          weight: 'bold',
          color: palette.redDark,
          maxLines: 1,
        },
        {
          type: 'text',
          text: `ของ ${truncate(name, 16)}`,
          size: 'sm',
          weight: 'bold',
          color: palette.muted,
          maxLines: 1,
        },
        {
          type: 'text',
          text: personaTitle,
          size: 'xl',
          weight: 'bold',
          color: palette.brown,
          wrap: true,
          maxLines: 2,
        },
      ],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 0,
      contents: [
        characterUrl
          ? {
              type: 'image',
              url: characterUrl,
              size: 'xs',
              aspectMode: 'fit',
              aspectRatio: '1:1',
              gravity: 'center',
            }
          : {
              type: 'box',
              layout: 'vertical',
              width: '80px',
              height: '80px',
              backgroundColor: palette.goldLight,
              cornerRadius: '12px',
              contents: [
                {
                  type: 'text',
                  text: '🍚',
                  size: 'xxl',
                  align: 'center',
                },
              ],
            },
      ],
    },
  ],
});

/**
 * Insight box (yellow background)
 * 💡 "วันนี้อาหารฟ้องว่า"
 * "[insight message]"
 */
const insightBox = ({ insight }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.gold,
  cornerRadius: '16px',
  paddingAll: '12px',
  spacing: '4px',
  margin: 'md',
  contents: [
    {
      type: 'text',
      text: '💡 วันนี้อาหารฟ้องว่า',
      size: 'sm',
      weight: 'bold',
      color: palette.text,
    },
    {
      type: 'text',
      text: insight,
      size: 'sm',
      color: palette.brown,
      wrap: true,
      maxLines: 2,
    },
  ],
});

/**
 * Stats card showing:
 * 📊 สรุปวันนี้
 * เหลือ 1140 kcal อยู่
 * Then metrics with emoji
 */
const statsCard = ({ eaten, target, carb, protein, fat, sugar, mealCount }) => {
  const over = Math.max(eaten - target, 0);
  const left = Math.max(target - eaten, 0);

  let statusText = `เหลือ ${Math.round(left)} kcal อยู่`;
  let statusColor = palette.green;

  if (eaten <= 0) {
    statusText = 'วันนี้ยังไม่มีมื้อที่บันทึก';
    statusColor = palette.muted;
  } else if (over > 0) {
    statusText = `เกินเป้า ${Math.round(over)} kcal`;
    statusColor = palette.red;
  } else if (left <= 250) {
    statusText = `เหลือ ${Math.round(left)} kcal ใกล้เต็ม`;
    statusColor = palette.orange;
  }

  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: palette.card,
    cornerRadius: '16px',
    paddingAll: '12px',
    spacing: '8px',
    borderWidth: '1px',
    borderColor: palette.border,
    margin: 'md',
    contents: [
      {
        type: 'text',
        text: '📊 สรุปวันนี้',
        size: 'sm',
        weight: 'bold',
        color: palette.text,
      },
      {
        type: 'text',
        text: statusText,
        size: 'md',
        weight: 'bold',
        color: statusColor,
        wrap: true,
      },
      {
        type: 'separator',
        color: palette.border,
        margin: 'sm',
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '🔥 กินไป', size: 'sm', color: palette.muted, flex: 4 },
          {
            type: 'text',
            text: `${Math.round(eaten)} / ${Math.round(target)} kcal`,
            size: 'sm',
            weight: 'bold',
            color: over > 0 ? palette.red : palette.text,
            align: 'end',
            flex: 6,
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '🍚 คาร์บ', size: 'sm', color: palette.muted, flex: 4 },
          { type: 'text', text: `${Math.round(carb)} g`, size: 'sm', weight: 'bold', color: palette.text, align: 'end', flex: 6 },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '💪 โปรตีน', size: 'sm', color: palette.muted, flex: 4 },
          {
            type: 'text',
            text: `${Math.round(protein)} g`,
            size: 'sm',
            weight: 'bold',
            color: protein >= 70 ? palette.green : palette.orange,
            align: 'end',
            flex: 6,
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '💧 ไขมัน', size: 'sm', color: palette.muted, flex: 4 },
          { type: 'text', text: `${Math.round(fat)} g`, size: 'sm', weight: 'bold', color: palette.text, align: 'end', flex: 6 },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '🍬 น้ำตาล', size: 'sm', color: palette.muted, flex: 4 },
          { type: 'text', text: `${Math.round(sugar)} g`, size: 'sm', weight: 'bold', color: palette.text, align: 'end', flex: 6 },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '🍽️ มื้อ', size: 'sm', color: palette.muted, flex: 4 },
          { type: 'text', text: `${Math.round(mealCount)} มื้อ`, size: 'sm', weight: 'bold', color: palette.text, align: 'end', flex: 6 },
        ],
      },
    ],
  };
};

/**
 * Two-column suggestion box
 * Left: 🎯 เป้าหมาย (goal)
 * Right: ⭐ มื้อเด่น (top meal)
 */
const suggestionBox = ({ goal, topMeal }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '10px',
  margin: 'md',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      backgroundColor: palette.lightGreen,
      cornerRadius: '14px',
      paddingAll: '12px',
      spacing: '4px',
      contents: [
        { type: 'text', text: '🎯 เป้าหมาย', size: 'sm', weight: 'bold', color: palette.text },
        { type: 'text', text: goal, size: 'xs', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      backgroundColor: palette.lightBlue,
      cornerRadius: '14px',
      paddingAll: '12px',
      spacing: '4px',
      contents: [
        { type: 'text', text: '⭐ มื้อเด่น', size: 'sm', weight: 'bold', color: palette.text },
        { type: 'text', text: topMeal, size: 'xs', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
  ],
});

/**
 * Footer message
 * 📸 [closing message]
 */
const footerBox = ({ message }) => ({
  type: 'box',
  layout: 'vertical',
  margin: 'md',
  contents: [
    {
      type: 'separator',
      color: palette.border,
      margin: 'sm',
    },
    {
      type: 'text',
      text: `📸 ${message}`,
      size: 'sm',
      weight: 'bold',
      color: palette.redDark,
      align: 'center',
      wrap: true,
      maxLines: 2,
      margin: 'sm',
    },
  ],
});

/**
 * Build persona title based on day and memory patterns
 */
const buildPersonaTitle = ({ day = {}, memory = {} }) => {
  if (memory.hasSweetPattern && (day.isOver || day.isVeryOver)) return 'หวานนำทีม';
  if (memory.hasHeavyPattern || day.isVeryOver) return 'ชีวิตติดมัน';
  if (memory.hasSweetPattern) return 'หวานมาเป็นบท';
  if (memory.hasFriedPattern) return 'ทอดบ่อยแต่ยังไหว';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนมีทรง';
  if (day.isNearLimit) return 'เกือบเต็มแต่เอาอยู่';
  return 'ยังเอาอยู่';
};

/**
 * Build insight message (what Pae noticed today)
 */
const buildInsightMessage = ({ day = {}, memory = {}, problemMeal = null }) => {
  if (memory.hasSweetPattern) return 'ใจอยากคุม แต่ของหวานมาเด่นจริง ๆ';
  if (memory.hasFriedPattern) return 'ใจอยากคุม แต่ของทอด/มันมาเด่นจริง ๆ';
  if (day.isVeryOver || memory.hasHeavyPattern) return 'ใจอยากคุม แต่วันนี้อยากกินเยอะซะแล้ว';
  if (problemMeal?.menuName) return `${truncate(problemMeal.menuName, 20)} นำทีมวันนี้`;
  return 'ทรงรวมวันนี้ยังพอไปได้';
};

/**
 * Build closing message (what to do next)
 */
const buildClosingMessage = ({ day = {}, memory = {} }) => {
  if (day.isOver || memory.hasHeavyPattern) return 'ต่อไป คุมของทอดกับน้ำหวานนิดนึง';
  if (memory.hasSweetPattern) return 'ต่อไป พักหวานสักรอบ แปะว่าเวิร์ก';
  if (memory.hasFriedPattern) return 'ต่อไป พักทอดนิดนึง แล้วไปต่อได้';
  if (day.goodProteinDay || memory.hasProteinWin) return 'ต่อไป คุมต่ออีกนิด ทรงนี้ใช้ได้';
  return 'ต่อไป คุมต่ออีกนิด';
};

/**
 * Main export: Build complete Daily Recap Flex Message
 * Matches the new design from the image
 */
export const buildDailyRecapFlexMessageNew = ({
  title = 'ลื้อ',
  summary = {},
  decision = {},
  characterUrl = '',
}) => {
  const day = decision.day || {};
  const memory = decision.memory || day.memory || {};
  const problemMeal = decision.problemMeal || (Array.isArray(day.meals) ? day.meals[0] : null) || null;

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

  const topMealText =
    problemMeal?.menuName && problemMeal?.menuName !== 'ยังไม่มีมื้อเด่น'
      ? truncate(`${problemMeal.menuName}${problemMeal?.kcal ? ` · ${Math.round(problemMeal.kcal)} kcal` : ''}`, 24)
      : 'ยังไม่มีมื้อเด่น';

  return {
    type: 'flex',
    altText: `สรุปวันนี้ของ ${truncate(title, 16)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '0px',
        backgroundColor: palette.cream,
        paddingAll: '14px',
        contents: [
          heroTitleBlock({ name: title, personaTitle, characterUrl }),
          insightBox({ insight: insightMessage }),
          statsCard({ eaten, target, carb, protein, fat, sugar, mealCount }),
          suggestionBox({ goal: goalText, topMeal: topMealText }),
          footerBox({ message: closingMessage }),
        ],
      },
    },
  };
};
