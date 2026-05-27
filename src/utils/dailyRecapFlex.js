const palette = {
  cream: '#FFF7EF',
  card: '#FFFFFF',
  border: '#EAD6C8',
  red: '#D93A2F',
  redDark: '#9F2F25',
  green: '#0F7A55',
  greenDark: '#155E45',
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
      size: 'xs',
      aspectMode: 'fit',
      aspectRatio: '1:1',
      gravity: 'center',
    };
  }

  return {
    type: 'box',
    layout: 'vertical',
    width: '54px',
    height: '54px',
    backgroundColor: palette.goldLight,
    cornerRadius: '16px',
    paddingAll: '6px',
    contents: [
      { type: 'text', text: '🍽️', size: 'xl', align: 'center' },
      { type: 'text', text: 'แปะ', size: 'xxs', align: 'center', weight: 'bold', color: palette.redDark },
    ],
  };
};

const statRow = ({ icon, label, value, color = palette.text }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '4px',
  contents: [
    {
      type: 'text',
      text: `${icon} ${label}`,
      size: 'xxs',
      color: palette.muted,
      flex: 5,
      wrap: false,
    },
    {
      type: 'text',
      text: String(value),
      size: 'xxs',
      color,
      weight: 'bold',
      align: 'end',
      flex: 6,
      wrap: true,
      maxLines: 2,
    },
  ],
});

const miniTextBlock = ({ title, body }) => ({
  type: 'box',
  layout: 'vertical',
  spacing: '2px',
  margin: 'sm',
  contents: [
    { type: 'text', text: title, size: 'xs', weight: 'bold', color: palette.text, wrap: true, maxLines: 1 },
    { type: 'text', text: body, size: 'xxs', color: palette.brown, wrap: true, maxLines: 3 },
  ],
});

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

const buildMoodLine = ({ day, memory }) => {
  if (day.isVeryOver || memory.hasHeavyPattern) return 'ตึงนิด แต่ยังตั้งหลักได้';
  if (day.isOver) return 'เกินนิด ยังไม่เกมแตก';
  if (memory.hasSweetPattern) return 'หวานถี่ แต่เบรกทัน';
  if (memory.hasFriedPattern) return 'ทอดเด่นไปนิด';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนดี แปะให้ผ่าน';
  return 'ไปได้เรื่อย ๆ';
};

const buildObservationLine = ({ problemMeal, memory }) => {
  if (memory.hasSweetPattern) return 'ของหวานมาเกินหนึ่งจังหวะ';
  if (memory.hasFriedPattern) return 'ของทอด/ของมันถี่ไปนิด';
  if (problemMeal?.menuName) return `${truncate(problemMeal.menuName, 28)} เด่นวันนี้`;
  return 'ยังไม่มีตัวป่วนแรง ๆ';
};

const buildNextLine = ({ day, memory }) => {
  if (day.isOver || memory.hasHeavyPattern) return 'เบามัน/หวานอีกมื้อ';
  if (memory.hasSweetPattern) return 'พักน้ำหวานสักรอบ';
  if (memory.hasFriedPattern) return 'พักทอดก่อนหนึ่งมื้อ';
  return 'คุมต่ออีกนิดพอ';
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
    statusText = 'วันนี้ยังไม่มีมื้อ';
    statusColor = palette.muted;
  } else if (over > 0) {
    statusText = `เกิน ${Math.round(over)} kcal`;
    statusColor = palette.red;
  } else if (left <= 250) {
    statusText = `เหลือ ${Math.round(left)} kcal`;
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
    goalText: truncate(normalize(summary.goal || summary.healthGoal || summary.userGoal, 'ยังไม่ได้ตั้งเป้า'), 24),
    topMealText: topMealName === 'ยังไม่มีมื้อเด่น' ? topMealName : truncate(`${topMealName}${topMealKcal ? ` · ${Math.round(topMealKcal)} kcal` : ''}`, 28),
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
        { type: 'text', text: 'TODAY RECAP', size: 'sm', weight: 'bold', color: palette.redDark, maxLines: 1 },
        { type: 'text', text: `ของ ${headerTitle}`, size: 'xs', weight: 'bold', color: palette.muted, maxLines: 1 },
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
  spacing: '4px',
  contents: [
    { type: 'text', text: 'วันนี้อาหารฟ้องว่า', size: 'md', weight: 'bold', color: palette.text, maxLines: 1 },
    { type: 'text', text: intro, size: 'sm', color: palette.brown, wrap: true, maxLines: 2 },
  ],
});

const summaryStatsCard = (stats) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.card,
  cornerRadius: '16px',
  paddingAll: '10px',
  spacing: '5px',
  borderWidth: '1px',
  borderColor: palette.border,
  flex: 1,
  contents: [
    { type: 'text', text: '📊 สรุปวันนี้', size: 'xs', weight: 'bold', color: palette.text, maxLines: 1 },
    { type: 'text', text: stats.statusText, size: 'xs', weight: 'bold', color: stats.statusColor, wrap: true, maxLines: 2 },
    { type: 'separator', color: '#EFE4D9', margin: 'xs' },
    statRow({ icon: '🔥', label: 'กิน', value: `${Math.round(stats.eaten)}/${Math.round(stats.target)}`, color: palette.red }),
    statRow({ icon: '🍚', label: 'คาร์บ', value: `${Math.round(stats.carb)}g` }),
    statRow({ icon: '💪', label: 'โปรตีน', value: `${Math.round(stats.protein)}g`, color: stats.protein >= 70 ? palette.green : palette.orange }),
    statRow({ icon: '💧', label: 'ไขมัน', value: `${Math.round(stats.fat)}g` }),
    statRow({ icon: '🍬', label: 'น้ำตาล', value: `${Math.round(stats.sugar)}g` }),
    statRow({ icon: '🍽', label: 'มื้อ', value: `${Math.round(stats.mealCount)}` }),
  ],
});

const insightCard = ({ observation, mood, nextLine }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.card,
  cornerRadius: '16px',
  paddingAll: '10px',
  spacing: '2px',
  borderWidth: '1px',
  borderColor: palette.border,
  flex: 1,
  contents: [
    miniTextBlock({ title: '👀 แต่...', body: observation }),
    miniTextBlock({ title: '😅 Mood', body: mood }),
    miniTextBlock({ title: '❤️ ต่อไป', body: nextLine }),
  ],
});

const goalTopMealCard = ({ goalText, topMealText }) => ({
  type: 'box',
  layout: 'horizontal',
  backgroundColor: palette.blue,
  cornerRadius: '18px',
  paddingAll: '12px',
  spacing: '10px',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '3px',
      contents: [
        { type: 'text', text: '🎯 เป้า', size: 'sm', weight: 'bold', color: palette.text, maxLines: 1 },
        { type: 'text', text: goalText, size: 'xs', color: palette.brown, wrap: true, maxLines: 2 },
      ],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '3px',
      contents: [
        { type: 'text', text: '👀 มื้อเด่น', size: 'sm', weight: 'bold', color: palette.text, maxLines: 1 },
        { type: 'text', text: topMealText, size: 'xs', color: palette.brown, wrap: true, maxLines: 2 },
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
  const mood = buildMoodLine({ day, memory });
  const observation = buildObservationLine({ problemMeal, memory });
  const nextLine = buildNextLine({ day, memory });
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
          {
            type: 'box',
            layout: 'horizontal',
            spacing: '8px',
            contents: [summaryStatsCard(stats), insightCard({ observation, mood, nextLine })],
          },
          goalTopMealCard({ goalText: stats.goalText, topMealText: stats.topMealText }),
          { type: 'separator', margin: 'xs', color: palette.border },
          { type: 'text', text: '📸 แคปไว้ก่อน เดี๋ยวพรุ่งนี้แปะถามใหม่', size: 'sm', weight: 'bold', color: palette.redDark, align: 'center', wrap: true, maxLines: 2 },
        ],
      },
    },
  };
};
