const palette = {
  cream: '#FFF7ED',
  card: '#FFFDF8',
  red: '#E11D1D',
  redDark: '#A63F27',
  green: '#14532D',
  gold: '#F7D98B',
  blue: '#BDEAF3',
  blueSoft: '#E8FAFD',
  brown: '#5D332D',
  text: '#1F2937',
  muted: '#6B7280',
  line: '#EADDD0',
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

const shorten = (value, max = 42) => {
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
      flex: 2,
    };
  }

  return {
    type: 'box',
    layout: 'vertical',
    flex: 2,
    backgroundColor: '#FFE8B5',
    cornerRadius: '14px',
    paddingAll: '6px',
    contents: [
      { type: 'text', text: '🧧', size: 'xl', align: 'center' },
      { type: 'text', text: 'แปะ', size: 'xs', weight: 'bold', color: palette.redDark, align: 'center' },
    ],
  };
};

const statRow = ({ icon, label, value, color = palette.text }) => ({
  type: 'box',
  layout: 'horizontal',
  spacing: '4px',
  margin: 'xs',
  contents: [
    { type: 'text', text: `${icon} ${label}`, size: 'xs', color: palette.muted, flex: 5, wrap: false },
    { type: 'text', text: value, size: 'xs', weight: 'bold', color, flex: 6, align: 'end', wrap: true },
  ],
});

const miniNote = ({ icon, title, body }) => ({
  type: 'box',
  layout: 'vertical',
  spacing: '1px',
  margin: 'sm',
  contents: [
    { type: 'text', text: `${icon} ${title}`, size: 'xs', weight: 'bold', color: palette.text, wrap: true },
    { type: 'text', text: shorten(body, 48), size: 'xs', color: palette.brown, wrap: true },
  ],
});

const buildPersonaTitle = ({ day, memory }) => {
  if (memory.hasSweetPattern && (day.isOver || day.isVeryOver)) return 'ชีวิตติดหวาน';
  if (memory.hasHeavyPattern || day.isVeryOver) return 'ชีวิตติดมัน';
  if (memory.hasSweetPattern) return 'หวานนำทีม';
  if (memory.hasFriedPattern) return 'ทอดบ่อยแต่ยังไหว';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนมีทรง';
  if (day.isNearLimit) return 'เกือบเต็มแต่เอาอยู่';
  return 'ยังเอาอยู่';
};

const buildIntroLine = ({ day, memory }) => {
  if (memory.hasSweetPattern && day.isOver) return 'หวานมานำ แต่ยังดึงเกมกลับได้';
  if (memory.hasHeavyPattern || day.isVeryOver) return 'ของมันกับของแน่น มีบทวันนี้';
  if (memory.hasSweetPattern) return 'หวานมาเป็นจังหวะอยู่';
  if (memory.hasFriedPattern) return 'ของทอดแวะมาหลายรอบ';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนวันนี้มีเรื่องให้ชม';
  return 'ทรงรวมวันนี้ยังพอไปได้';
};

const buildMoodLine = ({ day, memory }) => {
  if (day.isVeryOver || memory.hasHeavyPattern) return 'หลุดแบบมีหลักฐาน แต่ยังตั้งหลักได้';
  if (day.isOver) return 'เกินนิด ๆ แต่ยังไม่เกมแตก';
  if (memory.hasSweetPattern) return 'หวานถี่ไปนิด แต่ยังเบรกทัน';
  if (memory.hasFriedPattern) return 'ของทอดเด่นไปหน่อย แต่ยังคุมต่อได้';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนมาดี แปะให้ผ่าน';
  return 'ไปได้เรื่อย ๆ ยังไม่หลุดโค้ง';
};

const buildObservationLine = ({ problemMeal, memory }) => {
  if (memory.hasSweetPattern) return 'ของหวานมีบท แปะเห็นนะ';
  if (memory.hasFriedPattern) return 'ของทอด/ของมันมาถี่นิดนึง';
  if (problemMeal?.menuName) return `${problemMeal.menuName} เด่นวันนี้`;
  return 'ยังไม่มีตัวป่วนแรง ๆ';
};

const buildNextLine = ({ day, memory }) => {
  if (day.isOver || memory.hasHeavyPattern) return 'เบาลงนิด เติมผัก/โปรตีนพอ';
  if (memory.hasSweetPattern) return 'พักน้ำหวาน แล้วไปทางโปรตีน';
  if (memory.hasFriedPattern) return 'พักทอดสักมื้อ ไปทางต้ม/ย่าง';
  return 'คุมทอดกับน้ำหวานนิดนึง';
};

const buildStats = ({ day, summary = {}, problemMeal }) => {
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
    statusText = `เกินประมาณ ${Math.round(over)} kcal`;
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
    goalText: shorten(normalize(summary.goal || summary.healthGoal || summary.userGoal, 'ยังไม่ได้ตั้งเป้าสุขภาพ'), 34),
    topMealText: topMealName === 'ยังไม่มีมื้อเด่น' ? topMealName : shorten(`${topMealName}${topMealKcal ? ` · ${Math.round(topMealKcal)} kcal` : ''}`, 38),
  };
};

const headerBlock = ({ title, personaTitle, mascotUrl }) => ({
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
        { type: 'text', text: 'TODAY RECAP', size: 'xs', weight: 'bold', color: palette.redDark, wrap: false },
        { type: 'text', text: `ของ ${title}`, size: 'xs', color: palette.muted, weight: 'bold', wrap: true },
        { type: 'text', text: personaTitle, size: 'xl', weight: 'bold', color: palette.brown, wrap: true, margin: 'xs' },
      ],
    },
    mascotNode(mascotUrl),
  ],
});

const foodMoodCard = ({ intro }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.gold,
  cornerRadius: '20px',
  paddingAll: '12px',
  spacing: '3px',
  contents: [
    { type: 'text', text: 'วันนี้อาหารฟ้องว่า:', size: 'md', weight: 'bold', color: palette.text, wrap: true },
    { type: 'text', text: intro, size: 'sm', color: palette.brown, weight: 'bold', wrap: true },
  ],
});

const summaryMiniCard = (stats) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.card,
  cornerRadius: '16px',
  paddingAll: '10px',
  spacing: '4px',
  borderWidth: '1px',
  borderColor: palette.line,
  flex: 1,
  contents: [
    { type: 'text', text: '📊 สรุปวันนี้', size: 'sm', weight: 'bold', color: palette.text },
    { type: 'text', text: stats.statusText, size: 'xs', weight: 'bold', color: stats.statusColor, wrap: true },
    { type: 'separator', color: palette.line, margin: 'xs' },
    statRow({ icon: '🔥', label: 'กินไป', value: `${Math.round(stats.eaten)}/${Math.round(stats.target)}`, color: palette.red }),
    statRow({ icon: '🍚', label: 'คาร์บ', value: `${Math.round(stats.carb)}g` }),
    statRow({ icon: '💪', label: 'โปรตีน', value: `${Math.round(stats.protein)}g`, color: stats.protein >= 70 ? palette.green : palette.orange }),
    statRow({ icon: '💧', label: 'ไขมัน', value: `${Math.round(stats.fat)}g` }),
    statRow({ icon: '🍬', label: 'น้ำตาล', value: `${Math.round(stats.sugar)}g` }),
    statRow({ icon: '🍽️', label: 'มื้อ', value: `${Math.round(stats.mealCount)}` }),
  ],
});

const insightMiniCard = ({ observation, mood, nextLine }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.card,
  cornerRadius: '16px',
  paddingAll: '10px',
  spacing: '2px',
  borderWidth: '1px',
  borderColor: palette.line,
  flex: 1,
  contents: [
    miniNote({ icon: '👀', title: 'แต่...', body: observation }),
    miniNote({ icon: '😅', title: 'Mood', body: mood }),
    miniNote({ icon: '❤️', title: 'ต่อไป', body: nextLine }),
  ],
});

const goalCard = ({ goalText, topMealText }) => ({
  type: 'box',
  layout: 'horizontal',
  backgroundColor: palette.blue,
  cornerRadius: '20px',
  paddingAll: '12px',
  spacing: '10px',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '2px',
      contents: [
        { type: 'text', text: '🎯 เป้า', size: 'md', weight: 'bold', color: palette.text, wrap: true },
        { type: 'text', text: goalText, size: 'sm', color: palette.brown, wrap: true },
      ],
    },
    {
      type: 'box',
      layout: 'vertical',
      flex: 1,
      spacing: '2px',
      contents: [
        { type: 'text', text: '👀 มื้อเด่น', size: 'md', weight: 'bold', color: palette.text, wrap: true },
        { type: 'text', text: topMealText, size: 'sm', color: palette.brown, wrap: true },
      ],
    },
  ],
});

export const buildDailyRecapFlexMessage = ({ title, summary = {}, decision = {}, mascotUrl = '' }) => {
  const day = decision.day || {};
  const memory = decision.memory || day.memory || {};
  const problemMeal = decision.problemMeal || (Array.isArray(day.meals) ? day.meals[0] : null) || null;
  const headerTitle = normalize(title, 'ลื้อ');
  const personaTitle = buildPersonaTitle({ day, memory });
  const intro = buildIntroLine({ day, memory });
  const mood = buildMoodLine({ day, memory });
  const observation = buildObservationLine({ problemMeal, memory });
  const nextLine = buildNextLine({ day, memory });
  const stats = buildStats({ day, summary, problemMeal });

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
          headerBlock({ title: headerTitle, personaTitle, mascotUrl }),
          foodMoodCard({ intro }),
          {
            type: 'box',
            layout: 'horizontal',
            spacing: '8px',
            contents: [summaryMiniCard(stats), insightMiniCard({ observation, mood, nextLine })],
          },
          goalCard({ goalText: stats.goalText, topMealText: stats.topMealText }),
          { type: 'text', text: '🌿 แปะไว้ให้เตือนใจ 🌿', size: 'sm', weight: 'bold', color: palette.green, align: 'center' },
        ],
      },
    },
  };
};
