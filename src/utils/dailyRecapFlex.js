const palette = {
  cream: '#F7F1EB',
  brown: '#5D332D',
  mutedBrown: '#7B4E46',
  gold: '#F3D79B',
  pink: '#EFC0C4',
  purple: '#CFC3F3',
  blue: '#AEE5F2',
  grayText: '#4B5563',
  line: '#E5D8CC',
  green: '#3D6B52',
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalize = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
      margin: 'none',
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
      {
        type: 'text',
        text: '🧧',
        size: '3xl',
        align: 'center',
      },
      {
        type: 'text',
        text: 'แปะ',
        size: 'md',
        weight: 'bold',
        color: palette.brown,
        align: 'center',
      },
    ],
  };
};

const detailNode = (headline, body) => ({
  type: 'box',
  layout: 'vertical',
  flex: 6,
  spacing: '6px',
  justifyContent: 'center',
  contents: [
    {
      type: 'text',
      text: headline,
      weight: 'bold',
      size: 'xl',
      color: '#1F1B1A',
      wrap: true,
    },
    {
      type: 'text',
      text: body,
      wrap: true,
      size: 'lg',
      color: palette.brown,
    },
  ],
});

const sectionCard = ({ bgColor, imageBgColor, leftImage = false, headline, body, mascotUrl = '' }) => ({
  type: 'box',
  layout: 'horizontal',
  backgroundColor: bgColor,
  cornerRadius: '24px',
  paddingAll: '18px',
  spacing: '14px',
  contents: leftImage
    ? [mascotNode(imageBgColor || bgColor, mascotUrl), detailNode(headline, body)]
    : [detailNode(headline, body), mascotNode(imageBgColor || bgColor, mascotUrl)],
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
  if (memory.hasSweetPattern) return 'ของหวานวันนี้มาเกินหนึ่งจังหวะ 👀';
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

const buildMicroSummary = ({ day, summary, memory }) => {
  const eaten = safeNumber(day.eaten, safeNumber(summary.todayCalories || summary.totalToday, 0));
  const target = safeNumber(day.target, safeNumber(summary.calorieTarget, 2050));
  const over = Math.max(eaten - target, 0);
  const mealCount = safeNumber(day.mealCount, safeNumber(summary.mealCount, 0));
  const sugar = safeNumber(summary.totalSugar || day.sugar || memory.sugarCount || 0, 0);

  const bits = [];
  if (eaten > 0) bits.push(`🔥 ${Math.round(eaten)}/${Math.round(target)} kcal`);
  if (mealCount > 0) bits.push(`🍽️ ${Math.round(mealCount)} มื้อ`);
  if (sugar > 0) bits.push(`🍬 น้ำตาล ${Math.round(sugar)} g`);
  else if (memory.hasSweetPattern) bits.push('🍬 วันนี้หวานมีบท');
  if (over > 0) bits.push(`👀 เกิน ${Math.round(over)} kcal`);
  return bits.join('  ·  ');
};

export const buildDailyRecapFlexMessage = ({ title, summary = {}, decision = {}, mascotUrl = '' }) => {
  const day = decision.day || {};
  const memory = decision.memory || day.memory || {};
  const problemMeal = decision.problemMeal || null;
  const headerTitle = normalize(title, 'ลื้อ');
  const personaTitle = buildPersonaTitle({ day, memory });
  const intro = buildIntroLine({ day, memory });
  const mood = buildMoodLine({ day, memory });
  const observation = buildObservationLine({ problemMeal, memory });
  const nextLine = buildNextLine({ day, memory });
  const micro = buildMicroSummary({ day, summary, memory });

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
          {
            type: 'text',
            text: 'TODAY RECAP',
            size: 'md',
            weight: 'bold',
            color: '#A65B54',
            align: 'center',
          },
          {
            type: 'text',
            text: personaTitle,
            size: 'xxl',
            weight: 'bold',
            color: palette.brown,
            align: 'center',
            wrap: true,
          },
          {
            type: 'text',
            text: `ของ ${headerTitle}`,
            size: 'md',
            color: palette.grayText,
            align: 'center',
            wrap: true,
          },
          micro
            ? {
                type: 'text',
                text: micro,
                size: 'xs',
                color: '#7C6F67',
                align: 'center',
                wrap: true,
              }
            : null,
          sectionCard({
            bgColor: palette.gold,
            imageBgColor: '#EACF8D',
            leftImage: false,
            headline: 'วันนี้อาหารฟ้องว่า:',
            body: intro,
            mascotUrl,
          }),
          sectionCard({
            bgColor: palette.pink,
            imageBgColor: '#E7B3B8',
            leftImage: true,
            headline: 'Mood รวม:',
            body: mood,
            mascotUrl,
          }),
          sectionCard({
            bgColor: palette.purple,
            imageBgColor: '#BDB0E8',
            leftImage: false,
            headline: 'แปะเห็นนะ:',
            body: observation,
            mascotUrl,
          }),
          sectionCard({
            bgColor: palette.blue,
            imageBgColor: '#77DCE7',
            leftImage: true,
            headline: 'มื้อต่อไป:',
            body: nextLine,
            mascotUrl,
          }),
          {
            type: 'separator',
            margin: 'sm',
            color: palette.line,
          },
          {
            type: 'text',
            text: '🌿 แปะไว้ให้เตือนใจ 🌿',
            size: 'xl',
            weight: 'bold',
            color: '#4A5968',
            align: 'center',
          },
        ].filter(Boolean),
      },
    },
  };
};
