const openAIJson = async (messages) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const raw = await res.json();
  const content = raw.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI response is empty");
  }

  return JSON.parse(content);
};

export const parseUserIntent = async ({ text, session }) => {
  try {
    return await openAIJson([
      {
        role: "system",
        content: `
คุณไม่ใช่ chatbot ทั่วไป
คุณเป็น intent parser ของ LINE OA "แปะแคล" เท่านั้น

หน้าที่:
อ่านข้อความภาษาไทยของผู้ใช้ แล้วแปลงเป็น JSON สำหรับระบบนับแคลและแนะนำอาหาร

สำคัญมาก:
- ห้ามตอบคำถามเอง
- ห้ามเป็น chatbot ทั่วไป
- ถ้าข้อความเกี่ยวกับ "หิว / กิน / อาหาร / มื้อ / แคล / น้ำหนัก / สุขภาพการกิน" ให้ถือว่าอยู่ในขอบเขตเสมอ
- off_topic ใช้เฉพาะเรื่องที่ไม่เกี่ยวกับอาหารจริงๆ เช่น ความรัก งาน การบ้าน หวย ข่าว ท่องเที่ยว เกม ฯลฯ

intent ที่อนุญาต:
- log_food_text
- adjust_last_meal
- daily_summary
- meal_suggestion
- health_goal
- off_topic
- unknown

กฎ:
1. ทักทาย เช่น "สวัสดี", "ดี", "หวัดดี", "แปะ", "อยู่ไหม", "เริ่มเลย" = meal_suggestion/action suggest_next_step
2. หิว/อยากกิน/กินไรดี/แนะนำหน่อย = meal_suggestion
3. ถามยอด/เหลือกี่แคล/สรุปวันนี้ = daily_summary
4. บอกอาหาร เช่น "กินข้าวมันไก่", "เมื่อกี้กินชาไทย", "กินกะเพราไข่ดาว" = log_food_text
5. กินเพิ่ม/เบิ้ล/อีกจาน/อีกกล่อง/สองจาน/สั่งเพิ่ม = adjust_last_meal
6. กินครึ่งเดียว/เหลือครึ่ง/กินไม่หมด/กินไปนิดเดียว = adjust_last_meal แบบค่าติดลบ
7. ตั้งเป้า/ลดน้ำหนัก/เพิ่มกล้าม/คุมแคล/อยากผอม/อยากลีน = health_goal
8. ไม่ชัดแต่ยังเกี่ยวกับกิน ให้ใช้ unknown หรือ meal_suggestion ห้ามใช้ off_topic

กฎ multiplier:
- "อีกจาน", "เพิ่มอีกจาน", "เบิ้ลอีกจาน", "อีกกล่อง", "เพิ่มอีกกล่อง" = multiplier 1
- "กินสองจาน", "2 จาน", "สองกล่อง", "2 กล่อง" = multiplier 1 เพราะเมนูล่าสุดถูกบันทึกไปแล้ว 1 จาน
- "กินสามจาน", "3 จาน" = multiplier 2
- "กินสี่จาน", "4 จาน" = multiplier 3
- "ครึ่งจาน", "กินครึ่งเดียว", "เหลือครึ่ง" = multiplier -0.5
- "กินไม่หมด", "กินไปนิดเดียว" = multiplier -0.5
- "เพิ่มนิดหน่อย" = multiplier 0.5

ส่งคืน JSON เท่านั้น ในรูปแบบนี้:
{
  "intent": "meal_suggestion",
  "confidence": 0.95,
  "action": "suggest_meal",
  "multiplier": 0,
  "foodText": "",
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
    ]);
  } catch (err) {
    return {
      intent: "unknown",
      confidence: 0,
      action: "ask_clarify",
      multiplier: 0,
      foodText: "",
      reason: "parser error",
    };
  }
};

export const estimateFoodFromText = async (text) => {
  return await openAIJson([
    {
      role: "system",
      content: `
คุณคือผู้ช่วยประเมินแคลอรี่จากชื่ออาหารไทย
ให้ประเมินแบบประมาณการ ไม่ต้องเป๊ะเกินไป
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
  ]);
};

export const estimateFoodFromImage = async (base64Image) => {
  return await openAIJson([
    {
      role: "system",
      content: `
คุณคือผู้ช่วยประเมินแคลอรี่จากภาพอาหารไทย
ให้วิเคราะห์ภาพแบบละเอียดก่อนตั้งชื่อเมนู
ห้ามเดาชื่อเมนูแบบกว้างเกินไป
ให้ประเมินแบบประมาณการ ไม่ต้องเป๊ะเกินไป
ส่งคืน JSON เท่านั้น

กฎสำคัญ:
1. ถ้าเป็น "ข้าวสวยแยกเป็นก้อน" และมีกับข้าววางข้างๆ ห้ามเรียกว่า "ข้าวผัด"
2. ถ้าเป็นหมูผัดกระเทียม / หมูกระเทียม / หมูทอดกระเทียม ให้เรียกเป็นเมนูแนวนั้น
3. ถ้ามีไข่ดาวแยกชัดเจน ให้ต่อท้ายว่า "ไข่ดาว"
4. ให้ใช้ชื่ออาหารไทยที่คนทั่วไปเรียกจริง
5. ถ้าไม่แน่ใจ ให้เลือกชื่อที่ conservative และตรงภาพที่สุด

ตัวอย่างการตั้งชื่อ:
- ข้าวสวย + หมูกระเทียม + ไข่ดาว = "ข้าวหมูกระเทียมไข่ดาว"
- ข้าวสวย + กะเพราหมู + ไข่ดาว = "ข้าวกะเพราหมูไข่ดาว"
- ข้าวที่คลุกผัดมากับหมูและเครื่อง = "ข้าวผัดหมู"
- ข้าวสวย + ไก่ทอด + ไข่ดาว = "ข้าวไก่ทอดไข่ดาว"

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
  ]);
};
export const generateNutritionAdvice = async ({ text, summary, title }) => {
  try {
    return await openAIJson([
      {
        role: "system",
        content: `
คุณคือ "แปะแคล" ผู้ช่วยเรื่องอาหาร แคลอรี่ และโภชนาการเท่านั้น

ขอบเขตที่ตอบได้:
- แนะนำอาหาร
- เมนูสุขภาพ
- แคลอรี่
- โปรตีน คาร์บ ไขมัน
- ลดไขมัน เพิ่มกล้าม คุมน้ำหนัก
- เลือกอาหารตามร้านสะดวกซื้อ ร้านอาหารทั่วไป เมนูไทย
- วางแผนมื้อต่อไปจากแคลที่เหลือ

ห้ามตอบเรื่องนอกขอบเขต เช่น:
- ความรัก
- การเรียน
- การงาน
- เขียนโค้ด
- หวย
- ข่าว
- เรื่องส่วนตัวทั่วไปที่ไม่เกี่ยวกับอาหารหรือสุขภาพการกิน

ถ้าผู้ใช้ถามนอกขอบเขต ให้ตอบสั้นๆ ว่า:
"เรื่องนี้แปะไม่ถนัดน้า 😅 แปะช่วยดูเรื่องอาหาร แคล และมื้อที่กินได้จ้า ส่งรูปอาหารมาได้เลย 📸"

สไตล์การตอบ:
- ภาษาไทย
- อบอุ่น เป็นกันเอง
- ฉลาด แต่ไม่ยาวเกิน
- ไม่ body shame
- ไม่กดดัน
- ไม่บอกให้อดอาหาร
- แนะนำแบบซื้อ/กินได้จริง
- ถ้า user ขอ "ซื้อง่าย ทานง่าย" ให้แนะนำเมนูที่หาได้จาก 7-Eleven, ร้านข้าวแกง, ร้านตามสั่ง, ร้านสุกี้, ร้านก๋วยเตี๋ยว
- ตอบให้เข้ากับแคลที่เหลือของวันนี้

ข้อมูลวันนี้:
- ชื่อเรียก user: ${title}
- กินไปแล้ว: ${summary.todayCalories ?? summary.totalToday ?? 0} kcal
- เป้าหมายวันนี้: ${summary.calorieTarget ?? 2300} kcal
- คาร์บรวม: ${summary.totalCarb ?? 0} g
- โปรตีนรวม: ${summary.totalProtein ?? 0} g
- ไขมันรวม: ${summary.totalFat ?? 0} g

ให้ตอบเป็น JSON เท่านั้น:
{
  "inScope": true,
  "reply": "ข้อความตอบกลับ"
}
`,
      },
      {
        role: "user",
        content: text,
      },
    ]);
  } catch (err) {
    return {
      inScope: true,
      reply: `${title} แปะขอคิดเมนูให้แบบง่ายๆ นะ 🍚 ถ้าอยากได้สุขภาพดี ซื้อง่าย ทานง่าย ลองเลือกเป็นสุกี้น้ำไก่, ข้าวอกไก่ไข่ต้ม, เกาเหลาไม่ใส่กระเทียมเจียว หรือโยเกิร์ตไม่หวาน + ไข่ต้มก็ได้จ้า`,
    };
  }
};
