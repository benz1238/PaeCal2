const palette = {
  cream: '#FFF7EF',
  card: '#FFFFFF',
  border: '#EAD6C8',
  red: '#D93A2F',
  redDark: '#9F2F25',
  green: '#0F7A55',
  gold: '#F4D48A',
  goldLight: '#F9E5AF',
  blue: '#BFEAF2',
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

const truncate = (value, max = 34) => {
  const text = normalize(value, '');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const mascotNode = (mascotUrl = '') => {
  const url = normalize(mascotUrl, '');
  if (url) {
    return {
      type: 'image',
      url,
      size: 'sm',
      aspectMode: 'fit',
      aspectRatio: '1:1',
      gravity: 'center',
    };
  }

  return {
    type: 'box',
    layout: 'vertical',
    width: '58px',
    height: '58px',
    backgroundColor: palette.goldLight,
    cornerRadius: '18px',
    paddingAll: '6px',
    contents: [
      { type: 'text', text: '🍽️', size: 'xl', align: 'center' },
      { type: 'text', text: 'แปะ', size: 'xxs', align: 'center', weight: 'bold', color: palette.redDark },
    ],
  };
};

const buildPersonaTitle = ({ day, memory }) => {
  if (memory.hasSweetPattern && (day.isOver || day.isVeryOver)) return 'หวานนำทีม';
  if (memory.hasHeavyPattern || day.isVeryOver) return 'ชีวิตติดมัน';
  if (memory.hasSweetPattern) return 'หวานมาเป็นบท';
  if (memory.hasFriedPattern) return 'ทอดบ่อยแต่ยังไหว';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนมีทรง';
  if (day.isNearLimit) return 'เกือบเต็มแต่เอาอยู่';
  return 'ยังเอาอยู่';
};

const buildIntroLine = ({ personaTitle, day, memory }) => {
  if (personaTitle === 'โปรตีนมีทรง') return 'วันนี้มีมื้อที่แปะขอชมก่อน';
  if (personaTitle === 'หวานนำทีม' || personaTitle === 'หวานมาเป็นบท') return 'หวานมีบท แต่ยังไม่ต้องแพนิค';
  if (memory.hasHeavyPattern || day.isVeryOver) return 'ของแน่นมีบท วันนี้แปะเห็นอยู่';
  if (memory.hasFriedPattern) return 'ทอดมาเด่นนิดนึง แต่ยังคุมต่อได้';
  return 'ทรงรวมวันนี้ยังพอไปได้';
};

const buildFooterLine = ({ day, memory }) => {
  if (day.isOver || day.isVeryOver || memory.hasHeavyPattern) return 'ต่อไป คุมของทอดกับน้ำหวานนิดนึง';
  if (memory.hasSweetPattern) return 'ต่อไป พักหวานสักรอบ แปะว่าเวิร์ก';
  if (memory.hasFriedPattern) return 'ต่อไป พักทอดนิดนึง แล้วไปต่อได้';
  if (day.goodProteinDay || memory.hasProteinWin) return 'ต่อไป คุมต่ออีกนิด ทรงนี้ใช้ได้';
  return 'ต่อไป คุมต่ออีกนิด';
};

const buildCardStats = ({ day, summary = {}, problemMeal }) => {
  const eaten = safeNumber(day.eaten ?? summary.todayCalories ?? summary.totalToday, 0);
  const target = safeNumber(day.target ?? summary.calorieTarget, DEFAULT_CALORIE_TARGET);
  const over = Math.max(eaten - target, 0);
  const left = Math.max(target - eaten, 0);
  const carb = safeNumber(day.carb ?? summary.totalCarb, 0);
  const protein = safeNumber(day.protein ?? summary.totalProtein, 0);
  const fat = safeNumber(day.fat ?? summary.totalFat, 0);
  const sugar = safeNumber(day.sugar ?? summary.totalSugar, 0);
  const mealCount = safeNumber(day.mealCount ?? summary.mealCount, 0);

  let statusText = `เหลือ ${Math.round(left)} kcal อยู่`;
  let statusColor = palette.green;
  if (eaten <= 0) {
    statusText = 'วันนี้ยังไม่มีมื้อที่บันทึก';
    statusColor = palette.muted;
  } else if (over > 0) {
    statusText = `เกินเป้า ${Math.round(over)} kcal`;
    statusColor = palette.red;
  } else if (left <= 250) {
    statusText = `เหลือ ${Math.round(left)} kcal ใกล้เต็มแล้ว`;
    statusColor = palette.orange;
  }

  const topMealName = normalize(problemMeal?.menuName || problemMeal?.name || '', 'ยังไม่มีมื้อเด่น');
  const topMealKcal = safeNumber(problemMeal?.kcal || problemMeal?.totalKcal, 0);

  return {
    eaten,
    target,
    carb,
    protein,
    fat,
    sugar,
    mealCount,
    statusText,
    statusColor,
    goalText: truncate(normalize(summary.goal || summary.healthGoal || summary.userGoal, 'ยังไม่ได้ตั้งเป้า'), 28),
    topMealText: topMealName === 'ยังไม่มีมื้อเด่น' ? topMealName : truncate(`${topMealName}${topMealKcal ? ` · ${Math.round(topMealKcal)} kcal` : ''}`, 32),
  };
};

const headerBlock = ({ headerTitle, personaTitle, mascotUrl }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '8px',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 7,
      spacing: '2px',
      contents: [
        { type: 'text', text: 'TODAY RECAP', size: 'md', weight: 'bold', color: palette.redDark, maxLines: 1 },
        { type: 'text', text: `ของ ${headerTitle}`, size: 'sm', weight: 'bold', color: palette.muted, maxLines: 1 },
        { type: 'text', text: personaTitle, size: 'xxl', weight: 'bold', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
    { type: 'box', layout: 'vertical', flex: 3, contents: [mascotNode(mascotUrl)] },
  ],
});

const introCard = ({ intro }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.gold,
  cornerRadius: '20px',
  paddingAll: '12px',
  spacing: '5px',
  contents: [
    { type: 'text', text: 'วันนี้อาหารฟ้องว่า', size: 'lg', weight: 'bold', color: palette.text, maxLines: 1 },
    { type: 'text', text: intro, size: 'md', color: palette.brown, wrap: true, maxLines: 2 },
  ],
});

const compactMetric = ({ icon, label, value, color = palette.text }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '8px',
  contents: [
    { type: 'text', text: `${icon} ${label}`, size: 'sm', color: palette.muted, flex: 4, maxLines: 1 },
    { type: 'text', text: String(value), size: 'sm', color, weight: 'bold', align: 'end', flex: 5, maxLines: 1 },
  ],
});

const summaryStatsCard = (stats) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.card,
  cornerRadius: '18px',
  paddingAll: '13px',
  spacing: '7px',
  borderWidth: '1px',
  borderColor: palette.border,
  contents: [
    { type: 'text', text: '📊 สรุปวันนี้', size: 'lg', weight: 'bold', color: palette.text, maxLines: 1 },
    { type: 'text', text: stats.statusText, size: 'md', weight: 'bold', color: stats.statusColor, wrap: true, maxLines: 2 },
    { type: 'separator', color: '#EFE4D9', margin: 'xs' },
    compactMetric({ icon: '🔥', label: 'กินไป', value: `${Math.round(stats.eaten)} / ${Math.round(stats.target)} kcal`, color: palette.red }),
    compactMetric({ icon: '🍚', label: 'คาร์บ', value: `${Math.round(stats.carb)} g` }),
    compactMetric({ icon: '💪', label: 'โปรตีน', value: `${Math.round(stats.protein)} g`, color: stats.protein >= 70 ? palette.green : palette.orange }),
    compactMetric({ icon: '💧', label: 'ไขมัน', value: `${Math.round(stats.fat)} g` }),
    compactMetric({ icon: '🍬', label: 'น้ำตาล', value: `${Math.round(stats.sugar)} g` }),
    compactMetric({ icon: '🍽️', label: 'มื้อ', value: `${Math.round(stats.mealCount)} มื้อ` }),
  ],
});

const goalTopMealCard = ({ goalText, topMealText }) => ({
  type: 'box',
  layout: 'horizontal',
  backgroundColor: palette.blue,
  cornerRadius: '18px',
  paddingAll: '12px',
  spacing: '12px',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '4px',
      contents: [
        { type: 'text', text: '🎯 เป้าหมาย', size: 'md', weight: 'bold', color: palette.text, maxLines: 1 },
        { type: 'text', text: goalText, size: 'sm', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '4px',
      contents: [
        { type: 'text', text: '👀 มื้อเด่น', size: 'md', weight: 'bold', color: palette.text, maxLines: 1 },
        { type: 'text', text: topMealText, size: 'sm', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
  ],
});

export const buildDailyRecapFlexMessage = ({ title, summary = {}, decision = {}, mascotUrl = '' }) => {
  const day = decision.day || {};
  const memory = decision.memory || day.memory || {};
  const problemMeal = decision.problemMeal || (Array.isArray(day.meals) ? day.meals[0] : null) || null;
  const headerTitle = truncate(normalize(title, 'ลื้อ'), 16);
  const personaTitle = buildPersonaTitle({ day, memory });
  const intro = buildIntroLine({ personaTitle, day, memory });
  const footer = buildFooterLine({ day, memory });
  const stats = buildCardStats({ day, summary, problemMeal });

  return {
    type: 'flex',
    altText: `สรุปวันนี้ของ ${headerTitle}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '10px',
        backgroundColor: palette.cream,
        paddingAll: '14px',
        contents: [
          headerBlock({ headerTitle, personaTitle, mascotUrl }),
          introCard({ intro }),
          summaryStatsCard(stats),
          goalTopMealCard({ goalText: stats.goalText, topMealText: stats.topMealText }),
          { type: 'separator', margin: 'xs', color: palette.border },
          { type: 'text', text: `📸 ${footer}`, size: 'sm', weight: 'bold', color: palette.redDark, align: 'center', wrap: true, maxLines: 2 },
        ],
      },
    },
  };
};
