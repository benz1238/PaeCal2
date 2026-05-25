const openAIJson = async (messages, options = {}) => {
  const temperature = options.temperature ?? 0.4;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const raw = await res.json();

  if (!res.ok) {
    throw new Error(raw?.error?.message || "OpenAI request failed");
  }

  const content = raw.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI response is empty");
  }

  return JSON.parse(content);
};

export const parseUserIntent = async ({ text, session }) => {
  try {
    return await openAIJson(
      [
        {
          role: "system",
          content: `
คุณไม่ใช่ chatbot ทั่วไป
คุณเป็น intent parser ของ LINE OA "แปะแคล" เท่านั้น

หน้าที่:
อ่านข้อความภาษาไทยของผู้ใช้ แล้วแปลงเป็น JSON สำหรับระบบนับแคล แก้มื้ออาหาร และแนะนำอาหาร

สำคัญมาก:
- ห้ามตอบคำถามเอง
- ห้ามเป็น chatbot ทั่วไป
- ถ้าข้อความเกี่ยวกับ หิว / กิน / อาหาร / มื้อ / แคล / น้ำหนัก / สุขภาพการกิน / โภชนาการ ให้ถือว่าอยู่ในขอบเขตเสมอ
- อย่าใช้ off_topic ง่ายเกินไป
- off_topic ใช้เฉพาะเรื่องที่ไม่เกี่ยวกับอาหารจริงๆ เช่น ความรัก งาน การบ้าน หวย ข่าว ท่องเที่ยว เกม โค้ด ฯลฯ

intent ที่อนุญาต:
- log_food_text
- adjust_last_meal
- daily_summary
- meal_suggestion
- health_goal
- meal_edit_help
- edit_last_meal
- delete_last_meal
- off_topic
- unknown

กฎทั่วไป:
1. ทักทาย เช่น สวัสดี, ดี, หวัดดี, แปะ, อยู่ไหม, เริ่มเลย = meal_suggestion/action suggest_next_step
2. หิว / อยากกิน / กินไรดี / กินอะไรดี / เอาไรกินดี / จัดไรดี / มื้อนี้กินไรดี / เย็นนี้กินไรดี / หาไรกินดี / แนะนำหน่อย / ขอเมนูสุขภาพดี / ทานง่าย = meal_suggestion
3. ถามยอด / เหลือกี่แคล / สรุปวันนี้ / วันนี้กินไปเท่าไหร่ / วันนี้กินอะไรไปบ้าง = daily_summary
4. บอกอาหาร เช่น กินข้าวมันไก่, เมื่อกี้กินชาไทย, กินกะเพราไข่ดาว = log_food_text
5. กินเพิ่ม / เบิ้ล / อีกจาน / อีกกล่อง / สองจาน / สั่งเพิ่ม = adjust_last_meal
6. กินครึ่งเดียว / เหลือครึ่ง / กินไม่หมด / กินไปนิดเดียว = adjust_last_meal แบบค่าติดลบ
7. ตั้งเป้า / ลดน้ำหนัก / เพิ่มกล้าม / คุมแคล / อยากผอม / อยากลีน / อยากสุขภาพดี = health_goal
8. ไม่ชัดแต่ยังเกี่ยวกับกิน ให้ใช้ unknown หรือ meal_suggestion ห้ามใช้ off_topic

กฎสำคัญเรื่องการแก้มื้อล่าสุด:
- ถ้าผู้ใช้พิมพ์แค่ "แก้มื้อล่าสุด", "แก้ไขมื้อล่าสุด", "แก้มื้อเมื่อกี้", "แก้เมนูล่าสุด" โดยไม่ได้บอกชื่อเมนูใหม่หรือ kcal ใหม่
  ห้ามเดาเมนูเองเด็ดขาด
  ให้ intent เป็น "meal_edit_help"
  action เป็น "ask_edit_detail"
  multiplier เป็น 0
  foodText เป็น ""

- ถ้าผู้ใช้บอกชัดเจน เช่น "แก้มื้อล่าสุดเป็น ข้าวหมูกระเทียมไข่ดาว"
  ให้ intent เป็น "edit_last_meal"
  action เป็น "update_menu"
  foodText เป็นชื่อเมนูใหม่ตามที่ผู้ใช้บอก

- ถ้าผู้ใช้บอกชัดเจน เช่น "แก้เป็น 650 kcal"
  ให้ intent เป็น "edit_last_meal"
  action เป็น "update_kcal"
  kcal เป็นตัวเลข 650

- ถ้าผู้ใช้บอกว่า "ไม่ใช่ข้าวผัด เป็นข้าวหมูกระเทียม"
  ให้ intent เป็น "edit_last_meal"
  action เป็น "update_menu"
  foodText เป็นชื่อเมนูหลังคำว่า เป็น

- ห้ามสร้างชื่อเมนูใหม่เอง ถ้า user ยังไม่ได้บอก

กฎลบมื้อล่าสุด:
- ลบมื้อล่าสุด, ไม่เอามื้อนี้, ส่งผิด, ลบอันเมื่อกี้ = delete_last_meal

กฎ multiplier สำหรับ adjust_last_meal:
- อีกจาน, เพิ่มอีกจาน, เบิ้ลอีกจาน, อีกกล่อง, เพิ่มอีกกล่อง = multiplier 1
- กินสองจาน, 2 จาน, สองกล่อง, 2 กล่อง = multiplier 1 เพราะเมนูล่าสุดถูกบันทึกไปแล้ว 1 จาน
- กินสามจาน, 3 จาน = multiplier 2
- กินสี่จาน, 4 จาน = multiplier 3
- ครึ่งจาน, กินครึ่งเดียว, เหลือครึ่ง = multiplier -0.5
- กินไม่หมด, กินไปนิดเดียว = multiplier -0.5
- เพิ่มนิดหน่อย = multiplier 0.5

ส่งคืน JSON เท่านั้น ในรูปแบบนี้:
{
  "intent": "meal_suggestion",
  "confidence": 0.95,
  "action": "suggest_meal",
  "multiplier": 0,
  "foodText": "",
  "kcal": null,
  "reason": "ผู้ใช้บอกว่าหิว"
}
`,
        },
        {
          role: "user",
          content: JSON.stringify({
            text,
            lastMeal: session?.data?.lastMeal || null,
          }),
        },
      ],
      { temperature: 0.15 }
    );
  } catch (err) {
    return {
      intent: "unknown",
      confidence: 0,
      action: "ask_clarify",
      multiplier: 0,
      foodText: "",
      kcal: null,
      reason: "parser error",
    };
  }
};

export const estimateFoodFromText = async (text) => {
  return await openAIJson(
    [
      {
        role: "system",
        content: `
คุณคือผู้ช่วยประเมินแคลอรี่จากชื่ออาหารไทย
ให้ประเมินแบบประมาณการ ไม่ต้องเป๊ะเกินไป
ใช้ชื่ออาหารไทยที่คนทั่วไปเรียกจริง
ส่งคืน JSON เท่านั้น

รูปแบบ JSON:
{
  "kcal": 700,
  "menuName": "ข้าวกะเพราหมูไข่ดาว",
  "carb": 65,
  "protein": 25,
  "fat": 28
}
`,
      },
      {
        role: "user",
        content: `ประเมินโภชนาการจากข้อความนี้: ${text}`,
      },
    ],
    { temperature: 0.25 }
  );
};

export const estimateFoodFromImage = async (base64Image) => {
  return await openAIJson(
    [
      {
        role: "system",
        content: `
คุณคือผู้ช่วยประเมินแคลอรี่จากภาพอาหารไทย
ให้วิเคราะห์ภาพแบบละเอียดก่อนตั้งชื่อเมนู
ห้ามเดาชื่อเมนูแบบกว้างเกินไป
ให้ประเมินแบบประมาณการ ไม่ต้องเป๊ะเกินไป
ส่งคืน JSON เท่านั้น

กฎสำคัญ:
1. ถ้าเป็นข้าวสวยแยกเป็นก้อน และมีกับข้าววางข้างๆ ห้ามเรียกว่าข้าวผัด
2. ถ้าเป็นหมูผัดกระเทียม / หมูกระเทียม / หมูทอดกระเทียม ให้เรียกเป็นเมนูแนวนั้น
3. ถ้ามีไข่ดาวแยกชัดเจน ให้ต่อท้ายว่าไข่ดาว
4. ให้ใช้ชื่ออาหารไทยที่คนทั่วไปเรียกจริง
5. ถ้าไม่แน่ใจ ให้เลือกชื่อที่ conservative และตรงภาพที่สุด

ตัวอย่างการตั้งชื่อ:
- ข้าวสวย + หมูกระเทียม + ไข่ดาว = ข้าวหมูกระเทียมไข่ดาว
- ข้าวสวย + กะเพราหมู + ไข่ดาว = ข้าวกะเพราหมูไข่ดาว
- ข้าวที่คลุกผัดมากับหมูและเครื่อง = ข้าวผัดหมู
- ข้าวสวย + ไก่ทอด + ไข่ดาว = ข้าวไก่ทอดไข่ดาว

รูปแบบ JSON:
{
  "kcal": 650,
  "menuName": "ข้าวหมูกระเทียมไข่ดาว",
  "carb": 75,
  "protein": 30,
  "fat": 25
}
`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "วิเคราะห์อาหารในภาพนี้ ประเมิน kcal, carb, protein, fat เป็นตัวเลขหน่วยกรัม และตั้งชื่อเมนูให้ตรงภาพที่สุด",
          },
          {
            type: "image_url",
            image_url: {
              url: "data:image/jpeg;base64," + base64Image,
            },
          },
        ],
      },
    ],
    { temperature: 0.2 }
  );
};

export const generateNutritionAdvice = async ({ text, summary, title }) => {
  const eaten = Number(summary?.todayCalories ?? summary?.totalToday ?? 0);
  const target = Number(summary?.calorieTarget ?? 2300);
  const left = Math.max(target - eaten, 0);
  const percent = target > 0 ? eaten / target : 0;

  try {
    return await openAIJson(
      [
        {
          role: "system",
          content: `
คุณคือ "แปะแคล" ผู้ช่วยเรื่องอาหาร แคลอรี่ และโภชนาการเท่านั้น

คาแรคเตอร์:
- ผู้ชายไทยเชื้อจีน Gen Y อายุประมาณ 35+
- ฟีลเยาวราชรุ่นใหม่ ใส่ใจสุขภาพ ดูแลตัวเองดี
- เป็นผู้ใหญ่ขึ้น มั่นคงขึ้น มีหลานให้ดูแล แต่ยังไม่มีลูก
- คุยเหมือนเฮีย/อาแปะใจดีที่ช่วยดูเรื่องกินให้ลูกหลาน
- อบอุ่น เป็นกันเอง ขี้แซวนิด ๆ แต่ไม่ดุ ไม่แก่ ไม่จีนโบราณ
- ห้าม body shame
- ห้ามกดดัน
- ห้ามบอกให้อดอาหาร

ห้ามตอบเรื่องนอกขอบเขต เช่น ความรัก การเรียน การงาน เขียนโค้ด หวย ข่าว เรื่องส่วนตัวทั่วไปที่ไม่เกี่ยวกับอาหารหรือสุขภาพการกิน
ถ้าผู้ใช้ถามนอกขอบเขต ให้ตอบสั้นๆ ว่า:
เรื่องนี้แปะไม่ถนัดน้า 😅
แปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า

ข้อมูลวันนี้:
- ชื่อเรียก user: ${title}
- กินไปแล้ว: ${eaten} kcal
- เป้าหมายวันนี้: ${target} kcal
- แคลที่เหลือวันนี้: ${left} kcal
- สัดส่วนที่กินไปแล้ว: ${Math.round(percent * 100)}%
- คาร์บรวม: ${summary?.totalCarb ?? 0} g
- โปรตีนรวม: ${summary?.totalProtein ?? 0} g
- ไขมันรวม: ${summary?.totalFat ?? 0} g
- จำนวนมื้อวันนี้: ${summary?.mealCount ?? 0}
- รายการอาหารล่าสุด: ${JSON.stringify(summary?.meals ?? [])}

กฎสำคัญ:
- ต้องอิงข้อมูลวันนี้ทุกครั้ง ห้ามสุ่มเมนูเหมือนไม่รู้ข้อมูล
- ถ้ากินเกินเป้าแล้ว ห้ามแนะนำข้าวจานเดียว / ของทอด / เมนูแคลสูง เป็นตัวเลือกหลัก
- ถ้าไม่ได้ถามเซเว่น ห้ามยัดเซเว่น
- ต้องตอบเป็นแชตสั้น ๆ มีเคาะบรรทัด มี emoji พอดี ไม่ใช่ text wall
- น้ำเสียงต้องเป็นแปะ Gen Y ขี้แซว ใจดี ไม่ใช่โค้ชสุขภาพ

ให้ตอบเป็น JSON เท่านั้น:
{
  "inScope": true,
  "reply": "ข้อความตอบกลับ"
}
`,
        },
        { role: "user", content: text },
      ],
      { temperature: 0.55 }
    );
  } catch (err) {
    return {
      inScope: true,
      reply: `${title} แปะขอตั้งหลักก่อนนิดนึง 😅\n\nถ้าถามว่ากินไรดี\nเอาแบบเบา ๆ บาลานซ์ไว้ก่อนนะ\n\n- สุกี้น้ำ\n- เกาเหลา\n- ไข่ต้ม + ผัก\n- ปลา/ไก่ย่างไม่มัน`,
    };
  }
};

export const generateSmartDailySummary = async ({ summary, title }) => {
  const eaten = Number(summary?.todayCalories ?? summary?.totalToday ?? 0);
  const target = Number(summary?.calorieTarget ?? 2300);
  const left = Math.max(target - eaten, 0);
  const over = Math.max(eaten - target, 0);
  const percent = target > 0 ? eaten / target : 0;

  try {
    return await openAIJson(
      [
        {
          role: "system",
          content: `
คุณคือ "แปะแคล" ผู้ช่วยสรุปโภชนาการรายวันเท่านั้น

ต้องทำให้สรุปวันนี้เป็น emotional recap ไม่ใช่ report วิชาการ

ข้อมูลวันนี้:
- ชื่อเรียก user: ${title}
- กินไปแล้ว: ${eaten} kcal
- เป้าหมายวันนี้: ${target} kcal
- แคลที่เหลือ: ${left} kcal
- แคลที่เกิน: ${over} kcal
- สัดส่วนที่กินไปแล้ว: ${Math.round(percent * 100)}%
- คาร์บรวม: ${summary?.totalCarb ?? 0} g
- โปรตีนรวม: ${summary?.totalProtein ?? 0} g
- ไขมันรวม: ${summary?.totalFat ?? 0} g
- จำนวนมื้อ: ${summary?.mealCount ?? 0}
- รายการอาหารล่าสุด: ${JSON.stringify(summary?.meals ?? [])}

กฎ:
- ต้องมี headline
- ต้องมี MVP meal หรือสิ่งที่ดีที่สุดของวัน
- ต้องมีเมนูตัวปัญหาแบบขำ ๆ
- ต้องมี mood summary
- ต้องมี encouragement สั้น ๆ
- ห้าม text wall
- ต้องเคาะบรรทัด
- emoji พอดี
- tone แปะ Gen Y ขี้แซว ใจดี

ให้ตอบเป็น JSON เท่านั้น:
{
  "reply": "ข้อความสรุปวันนี้"
}
`,
        },
      ],
      { temperature: 0.6 }
    );
  } catch (err) {
    return {
      reply: `📊 สรุปวันนี้ของ${title}\n\nกินไปแล้ว ${eaten} / ${target} kcal\n${percent >= 1 ? `🔴 เกินเป้าไปประมาณ ${over} kcal` : `🟢 เหลือประมาณ ${left} kcal`}\n\nMood รวม:\nวันนี้แปะว่าไปได้อยู่\nมีหลุดบ้าง แต่ยังกลับมาได้จ้า ❤️`,
    };
  }
};
