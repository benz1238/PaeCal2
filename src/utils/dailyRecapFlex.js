const palette = {
  cream: '#F7F1EB',
  brown: '#5D332D',
  mutedBrown: '#7B4E46',
  gold: '#F3D79B',
  grayText: '#4B5563',
  line: '#E5D8CC',
  blue: '#AEE5F2',
  green: '#047857',
  red: '#DC2626',
  orange: '#D97706',
  dark: '#1F2937',
  white: '#FFFFFF',
  softCard: '#FFFDFC',
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

const mascotNode = (bgColor, mascotUrl = '') => {
  const url = normalize(mascotUrl, '');
  if (url) {
    return {
      type: 'image',
      url,
      size: 'sm',
      aspectMode: 'fit',
      aspectRatio: '1:1',
      flex: 4,
      gravity: 'center',
      backgroundColor: bgColor,
    };
  }

  return {
    type: 'box',
    layout: 'vertical',
    flex: 4,
    backgroundColor: bgColor,
    cornerRadius: '20px',
    justifyContent: 'center',
    alignItems: 'center',
    paddingAll: '10px',
    contents: [
      { type: 'text', text: '🧧', size: '3xl', align: 'center' },
      { type: 'text', text: 'แปะ', size: 'md', weight: 'bold', color: palette.brown, align: 'center' },
    ],
  };
};

const topSectionCard = ({ headline, body, mascotUrl = '' }) => ({
  type: 'box',
  layout: 'horizontal',
  backgroundColor: palette.gold,
  cornerRadius: '24px',
  paddingAll: '18px',
  spacing: '14px',
  contents: [
    {
      type: 'box',
      layout: 'vertical',
      flex: 6,
      spacing: '6px',
      justifyContent: 'center',
      contents: [
        { type: 'text', text: headline, weight: 'bold', size: 'xl', color: '#1F1B1A', wrap: true },
        { type: 'text', text: body, wrap: true, size: 'lg', color: palette.brown },
      ],
    },
    mascotNode('#EACF8D', mascotUrl),
  ],
});

const statRow = ({ icon, label, value, valueColor = palette.dark }) => ({
  type: 'box',
  layout: 'baseline',
  spacing: '8px',
  contents: [
    { type: 'text', text: `${icon} ${label}`, size: 'md', color: '#6B7280', flex: 4, wrap: true },
    { type: 'text', text: value, size: 'lg', weight: 'bold', color: valueColor, flex: 5, align: 'end', wrap: true },
  ],
});

const singleLabelBlock = ({ emoji, title, body }) => ({
  type: 'box',
  layout: 'vertical',
  spacing: '6px',
  contents: [
    { type: 'text', text: `${emoji} ${title}`, size: 'lg', weight: 'bold', color: palette.dark, wrap: true },
    { type: 'text', text: body, size: 'md', color: palette.brown, wrap: true },
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
  if (memory.hasSweetPattern) return 'วันนี้หวานมาเป็นจังหวะอยู่';
  if (memory.hasFriedPattern) return 'ของทอดแวะมาหลายรอบนิดนึง';
  if (day.goodProteinDay || memory.hasProteinWin) return 'โปรตีนวันนี้มีเรื่องให้ชม';
  return 'ทรงรวมวันนี้ยังพอไปได้';
};

const buildMoodLine = ({ day, memory }) => {
  if (day.isVeryOver || memory.hasHeavyPattern) return 'หลุดแบบมีหลักฐาน แต่ยังตั้งหลักได้';
  if (day.isOver) return 'เกินนิด ๆ แต่ยังไม่ถึงขั้นเกมแตก';
  if (memory.hasSweetPattern) return 'หวานถี่ไปนิด แต่ยังเบรกทัน';
  if (memory.hasFriedPattern) return 'ของทอดเด่นไปหน่อย แต่อยู่ในวิสัยคุมต่อ';
  if (day.goodProteinDay || memory.hasProteinWin) return 'ค่อนข้างโอเค มีทรงดูแลตัวเองอยู่';
  return 'ไปได้เรื่อย ๆ ยังไม่หลุดโค้ง';
};

const buildObservationLine = ({ problemMeal, memory }) => {
  if (memory.hasSweetPattern) return 'ของหวานวันนี้มาเกินหนึ่งจังหวะ แปะเห็นนะ 👀';
  if (memory.hasFriedPattern) return 'ของทอด/ของมันมาถี่ แปะเห็นอยู่นะ 👀';
  if (problemMeal?.menuName) return `${problemMeal.menuName} เป็นตัวเด่นของวันนี้ 👀`;
  return 'วันนี้ยังไม่มีตัวป่วนแรง ๆ';
};

const buildNextLine = ({ day, memory }) => {
  if (day.isOver || memory.hasHeavyPattern) return 'เลี่ยงทอดสักมื้อ เติมผักกับโปรตีนพอ';
  if (memory.hasSweetPattern) return 'พักน้ำหวานก่อนสักรอบ แล้วไปทางโปรตีนกับผัก';
  if (memory.hasFriedPattern) return 'พักทอดก่อนหนึ่งมื้อ แล้วไปทางต้ม/ย่างพอ';
  return 'คุมของทอดกับน้ำหวานนิดนึง แล้วไปต่อได้เลย';
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

  let statusText = `วันนี้ยังเหลือประมาณ ${Math.round(left)} kcal อยู่ 😄`;
  let statusColor = palette.green;
  if (eaten <= 0) {
    statusText = 'วันนี้ยังไม่มีมื้อที่แปะบันทึกไว้นะ';
    statusColor = '#6B7280';
  } else if (over > 0) {
    statusText = `เกินเป้าไปประมาณ ${Math.round(over)} kcal แล้วนะ 👀`;
    statusColor = palette.red;
  } else if (left <= 250) {
    statusText = `เหลือประมาณ ${Math.round(left)} kcal ใกล้เต็มแล้วนะ 😅`;
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
    goalText: normalize(summary.goal || summary.healthGoal || summary.userGoal, 'ยังไม่ได้ตั้งเป้าสุขภาพ'),
    topMealText: topMealName === 'ยังไม่มีมื้อเด่น' ? topMealName : `${topMealName}${topMealKcal ? ` · ${Math.round(topMealKcal)} kcal` : ''}`,
  };
};

const summaryStatsCard = (stats) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.white,
  cornerRadius: '22px',
  paddingAll: '18px',
  spacing: '10px',
  borderWidth: '1px',
  borderColor: '#E8DDD3',
  contents: [
    { type: 'text', text: '📊 สรุปวันนี้', size: 'lg', weight: 'bold', color: palette.dark },
    { type: 'text', text: stats.statusText, size: 'md', weight: 'bold', color: stats.statusColor, wrap: true },
    { type: 'separator', color: '#EFE4D9', margin: 'xs' },
    statRow({ icon: '🔥', label: 'กินไป', value: `${Math.round(stats.eaten)} / ${Math.round(stats.target)} kcal`, valueColor: palette.red }),
    statRow({ icon: '🍚', label: 'คาร์บ', value: `${Math.round(stats.carb)} g` }),
    statRow({ icon: '💪', label: 'โปรตีน', value: `${Math.round(stats.protein)} g`, valueColor: stats.protein >= 70 ? palette.green : palette.orange }),
    statRow({ icon: '💧', label: 'ไขมัน', value: `${Math.round(stats.fat)} g` }),
    statRow({ icon: '🍬', label: 'น้ำตาล', value: `${Math.round(stats.sugar)} g`, valueColor: stats.sugar >= 40 ? palette.red : palette.dark }),
    statRow({ icon: '🍽️', label: 'จำนวนมื้อ', value: `${Math.round(stats.mealCount)} มื้อ` }),
  ],
});

const insightCard = ({ observation, mood, nextLine }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.white,
  cornerRadius: '22px',
  paddingAll: '18px',
  spacing: '12px',
  borderWidth: '1px',
  borderColor: '#E8DDD3',
  contents: [
    singleLabelBlock({ emoji: '👀', title: 'แต่...', body: observation }),
    singleLabelBlock({ emoji: '😅', title: 'Mood รวม', body: mood }),
    singleLabelBlock({ emoji: '❤️', title: 'มื้อต่อไป', body: nextLine }),
  ],
});

const goalTopMealCard = ({ goalText, topMealText }) => ({
  type: 'box',
  layout: 'vertical',
  backgroundColor: palette.blue || '#AEE5F2',
  cornerRadius: '22px',
  paddingAll: '18px',
  spacing: '14px',
  contents: [
    { type: 'text', text: '🎯 เป้า + 🍽️ มื้อเด่น', size: 'lg', weight: 'bold', color: palette.dark },
    {
      type: 'box',
      layout: 'horizontal',
      spacing: '12px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 4,
          spacing: '6px',
          contents: [
            { type: 'text', text: '🎯 เป้า', size: 'md', weight: 'bold', color: palette.dark },
            { type: 'text', text: goalText, size: 'md', color: palette.brown, wrap: true },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          flex: 5,
          spacing: '6px',
          contents: [
            { type: 'text', text: '👀 มื้อเด่น', size: 'md', weight: 'bold', color: palette.dark },
            { type: 'text', text: topMealText, size: 'md', color: palette.brown, wrap: true },
          ],
        },
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
  const stats = buildCardStats({ day, summary, problemMeal });

  return {
    type: 'flex',
    altText: `สรุปวันนี้ของ ${headerTitle}`,
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '18px',
        backgroundColor: palette.cream,
        paddingAll: '20px',
        contents: [
          { type: 'text', text: 'TODAY RECAP', size: 'md', weight: 'bold', color: '#A65B54', align: 'center' },
          { type: 'text', text: personaTitle, size: 'xxl', weight: 'bold', color: palette.brown, align: 'center', wrap: true },
          { type: 'text', text: `ของ ${headerTitle}`, size: 'md', color: palette.grayText, align: 'center', wrap: true },
          topSectionCard({ headline: 'วันนี้อาหารฟ้องว่า:', body: intro, mascotUrl }),
          summaryStatsCard(stats),
          insightCard({ observation, mood, nextLine }),
          goalTopMealCard({ goalText: stats.goalText, topMealText: stats.topMealText }),
          { type: 'separator', margin: 'sm', color: palette.line },
          { type: 'text', text: '🌿 แปะไว้ให้เตือนใจ 🌿', size: 'xl', weight: 'bold', color: '#4A5968', align: 'center' },
        ],
      },
    },
  };
};
