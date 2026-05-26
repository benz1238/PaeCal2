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
  const estimated = await openAIJson(
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
  "fat": 28,
  "items": [
    { "name": "ข้าวกะเพราหมูไข่ดาว", "quantity": "1 จาน", "kcal": 700 }
  ]
}

กฎสำคัญสำหรับข้อความที่มีหลายรายการอาหาร:
- ถ้าผู้ใช้พิมพ์หลายอย่างในข้อความเดียว เช่น ข้าวมันไก่ 1 จาน / ชาไทยหวานน้อย / ขนมเลย์ 1 ห่อ
  ให้แยกรายการใน items ทุกครั้ง
- ถ้าข้อความมี / หรือขึ้นบรรทัดใหม่ เช่น ชามะนาว / มะม่วง / ส้มโอ ให้ถือว่าเป็น 3 รายการแยกกัน
- ห้ามรวมชื่อรายการหลายอย่างเป็นชื่อกว้าง ๆ เช่น "เครื่องดื่มผลไม้", "ผลไม้รวม", "เครื่องดื่มหลายอย่าง", "อาหารหลายอย่าง" ถ้าผู้ใช้ระบุชื่อไว้แล้ว
- menuName หลักให้รวมชื่อรายการแบบอ่านง่าย เช่น "ชามะนาว + มะม่วง + ส้มโอ"
- ถ้าผู้ใช้พิมพ์ชื่อคนละอย่างคั่นด้วย / หรือขึ้นบรรทัดใหม่ ให้คงชื่อแต่ละอย่างไว้ใน menuName และ items อย่าตีความเป็นเมนูใหม่
- ชามะนาวเป็นเครื่องดื่ม, มะม่วงและส้มโอเป็นผลไม้ ไม่ใช่น้ำผลไม้ เว้นแต่ผู้ใช้บอกว่าเป็นน้ำ/ปั่น
- ถ้ามีทั้งเครื่องดื่มและผลไม้ในข้อความเดียว ให้คงแยกเป็นหลายรายการ ไม่รวมเป็น "น้ำผลไม้" หรือ "เครื่องดื่มผลไม้"
- kcal หลักด้านบนต้องเป็นผลรวมโดยประมาณของ items
- carb/protein/fat ด้านบนเป็นผลรวมคร่าว ๆ ทั้งมื้อ
- items แต่ละรายการใช้ kcal ต่อรายการเท่านั้น ไม่ต้องใส่ macro ราย item
- quantity ให้คงตามที่ผู้ใช้บอก ถ้าไม่ชัดให้ใช้คำว่า "ประมาณ"
`,
      },
      {
        role: "user",
        content: `ประเมินโภชนาการจากข้อความนี้: ${text}`,
      },
    ],
    { temperature: 0.25 }
  );

  return {
    kcal: Number(estimated?.kcal) || 0,
    menuName: estimated?.menuName || String(text || "").trim() || "อาหาร",
    carb: Number(estimated?.carb) || 0,
    protein: Number(estimated?.protein) || 0,
    fat: Number(estimated?.fat) || 0,
    items: Array.isArray(estimated?.items)
      ? estimated.items
          .map((item) => ({
            name: String(item?.name || "").trim(),
            quantity: String(item?.quantity || "").trim(),
            kcal: Number(item?.kcal) || 0,
          }))
          .filter((item) => item.name && item.kcal > 0)
      : [],
  };
};

export const reviseFoodEstimateFromCorrection = async ({ previousMeal, correctionText }) => {
  const estimated = await openAIJson(
    [
      {
        role: "system",
        content: `
คุณคือผู้ช่วยปรับประมาณการแคลอรี่จากข้อความแก้ไขของผู้ใช้
ให้ใช้ previousMeal เป็นฐาน แล้วแก้เฉพาะสิ่งที่ผู้ใช้บอก
เช่น แก้วใหญ่เป็นแก้วเล็ก, กินครึ่งห่อ, เอาหนังไก่ออก, ไม่ใช่เมนูนี้
ส่งคืน JSON เท่านั้น

รูปแบบ JSON:
{
  "kcal": 850,
  "menuName": "ข้าวมันไก่เอาหนังออก + ชาไทยแก้วเล็ก + ขนมเลย์ครึ่งห่อ",
  "carb": 95,
  "protein": 32,
  "fat": 28,
  "items": [
    { "name": "ข้าวมันไก่เอาหนังออก", "quantity": "1 จาน", "kcal": 520 },
    { "name": "ชาไทยหวานน้อย", "quantity": "แก้วเล็ก", "kcal": 120 },
    { "name": "ขนมเลย์", "quantity": "ครึ่งห่อ", "kcal": 120 }
  ]
}

กฎสำคัญ:
- อย่าทิ้งรายการเดิม ถ้าผู้ใช้ไม่ได้บอกให้ลบ
- ปรับ kcal ให้สมเหตุสมผลตาม correctionText
- ถ้ามีหลายรายการ ให้คง items หลายรายการไว้
- kcal ด้านบนต้องเป็นผลรวมคร่าว ๆ ของ items
- macro ด้านบนเป็นผลรวมคร่าว ๆ ทั้งมื้อ
- ตอบ JSON เท่านั้น
`,
      },
      {
        role: "user",
        content: `previousMeal:
${JSON.stringify(previousMeal || {}, null, 2)}

correctionText:
${correctionText}`,
      },
    ],
    { temperature: 0.15 }
  );

  return {
    kcal: Number(estimated?.kcal) || Number(previousMeal?.kcal) || 0,
    menuName: estimated?.menuName || previousMeal?.menuName || "อาหาร",
    carb: Number(estimated?.carb) || Number(previousMeal?.carb) || 0,
    protein: Number(estimated?.protein) || Number(previousMeal?.protein) || 0,
    fat: Number(estimated?.fat) || Number(previousMeal?.fat) || 0,
    items: Array.isArray(estimated?.items)
      ? estimated.items
          .map((item) => ({
            name: String(item?.name || "").trim(),
            quantity: String(item?.quantity || "").trim(),
            kcal: Number(item?.kcal) || 0,
          }))
          .filter((item) => item.name && item.kcal > 0)
      : Array.isArray(previousMeal?.items) ? previousMeal.items : [],
  };
};

export const estimateFoodFromImage = async (base64Image) => {
  return await openAIJson(
    [
      {
        role: "system",
        content: `
คุณคือผู้ช่วยประเมินภาพให้ LINE OA "แปะแคล"
หน้าที่หลักคือดูว่าในภาพเป็นอาหารไหม แล้วถ้าเป็นอาหารค่อยประเมินแคลอรี่
ให้วิเคราะห์ภาพแบบละเอียดก่อนตั้งชื่อเมนู
ห้ามเดาชื่อเมนูแบบกว้างเกินไป
ให้ประเมินแบบประมาณการ ไม่ต้องเป๊ะเกินไป
ส่งคืน JSON เท่านั้น

กฎสำคัญ:
1. ถ้าภาพไม่ใช่อาหารหรือเครื่องดื่มที่คนกิน/ดื่มได้ ให้ตั้ง isFood=false, kcal=0, menuName="", ระบุ imageSubject เป็นสิ่งที่เห็นชัดที่สุด เช่น "แมว", "หมา", "ไก่", "คน", "เอกสาร", "จอคอม", "วิว" และใส่ imageCaption เป็นคำบรรยายสั้น ๆ ของสิ่งที่เห็น เช่น "ไก่ถือกระป๋องกาแฟ", "รูปหน้าจอแชต", "คนถ่ายเซลฟี่"
2. ถ้าเป็นอาหารหรือเครื่องดื่มที่คนดื่มได้ เช่น โค้ก น้ำอัดลม ชานม กาแฟ โกโก้ น้ำหวาน ให้ตั้ง isFood=true และประเมิน kcal/carb/protein/fat ตามปกติ
2.1 ถ้าเห็นแบรนด์/ชื่อสินค้าบนแพ็กชัด เช่น Moccona, Nescafe, Birdy, Coke, Pepsi, Milo, Ovaltine ให้ใส่ brandName ด้วย
2.2 ถ้าเป็นแพ็กเกจสินค้ากาแฟ/เครื่องดื่ม เช่น กระปุกกาแฟ ซอง 3-in-1 กระป๋องพร้อมดื่ม ให้ใส่ productType และ packagedState ด้วย เช่น "กาแฟสำเร็จรูป", "กาแฟ 3-in-1", "กาแฟพร้อมดื่ม", "ready_to_drink", "packaged_product"
2.3 ถ้าเห็นว่าเป็นกระปุก/ซองกาแฟผงที่ยังไม่ได้ชง ให้ประเมินเป็น 1 serving / 1 แก้วโดยประมาณ ไม่ใช่ทั้งกระปุกทั้งซองใหญ่
2.4 ถ้าเป็นกาแฟดำ/instant coffee ไม่ใส่น้ำตาล ให้ kcal ต่ำมากได้ เช่น 5-20 kcal แต่ถ้าเป็น 3-in-1 หรือพร้อมดื่ม ให้ kcal สูงขึ้นตามสมเหตุสมผล
3. ถ้าเป็นข้าวสวยแยกเป็นก้อน และมีกับข้าววางข้างๆ ห้ามเรียกว่าข้าวผัด
4. ถ้าเป็นหมูผัดกระเทียม / หมูกระเทียม / หมูทอดกระเทียม ให้เรียกเป็นเมนูแนวนั้น
5. ถ้ามีไข่ดาวแยกชัดเจน ให้ต่อท้ายว่าไข่ดาว
6. ให้ใช้ชื่ออาหารไทยที่คนทั่วไปเรียกจริง
7. ถ้าไม่แน่ใจ ให้เลือกชื่อที่ conservative และตรงภาพที่สุด
8. ห้ามบอกว่ามองไม่ชัด ถ้าในภาพเห็นชัดว่าเป็นสิ่งที่ไม่ใช่อาหาร/เครื่องดื่ม ให้ระบุ imageSubject และ imageCaption ไปเลย
9. ถ้าภาพมีวัตถุ/สัตว์ทำอะไรแปลก ๆ ให้ใส่รายละเอียดนั้นใน imageCaption เช่น ไก่ถือกระป๋องกาแฟ, แมวนั่งบนโต๊ะ, รูปหน้าจอคอม
10. ถ้าภาพเป็นเครื่องดื่มเดี่ยว ๆ เช่น กระป๋องโค้ก ขวดน้ำอัดลม แก้วชานม ให้ถือเป็นของกินและบันทึกได้ ไม่ใช่ no-food

ตัวอย่างการตั้งชื่อ:
- ข้าวสวย + หมูกระเทียม + ไข่ดาว = ข้าวหมูกระเทียมไข่ดาว
- ข้าวสวย + กะเพราหมู + ไข่ดาว = ข้าวกะเพราหมูไข่ดาว
- ข้าวที่คลุกผัดมากับหมูและเครื่อง = ข้าวผัดหมู
- ข้าวสวย + ไก่ทอด + ไข่ดาว = ข้าวไก่ทอดไข่ดาว

รูปแบบ JSON ถ้าเป็นอาหาร:
{
  "isFood": true,
  "imageSubject": "อาหาร",
  "imageCaption": "จานข้าวหมูกระเทียมไข่ดาว",
  "brandName": "",
  "productType": "",
  "packagedState": "",
  "kcal": 650,
  "menuName": "ข้าวหมูกระเทียมไข่ดาว",
  "carb": 75,
  "protein": 30,
  "fat": 25,
  "portionLevel": "normal",
  "portionNote": "ปริมาณประมาณหนึ่งมื้อพอดี",
  "confidence": "medium"
}

ตัวอย่างสินค้ากาแฟ/เครื่องดื่ม:
- กระปุก Moccona instant coffee / Selection: menuName="กาแฟมอคโคน่า", brandName="Moccona", productType="กาแฟสำเร็จรูป", packagedState="packaged_product", kcal ประมาณ 5-20 ต่อกาแฟดำ 1 แก้ว
- ซอง Nescafe 3-in-1: menuName="กาแฟเนสกาแฟ", brandName="Nescafe", productType="กาแฟ 3-in-1", packagedState="single_sachet", kcal ประมาณ 80-120 ต่อ 1 ซอง
- กระป๋อง Birdy พร้อมดื่ม: menuName="กาแฟเบอร์ดี้", brandName="Birdy", productType="กาแฟพร้อมดื่ม", packagedState="ready_to_drink", kcal ประมาณ 90-150 ต่อ 1 กระป๋อง
- Coke Zero / ไม่มีน้ำตาล: kcal=0, carb=0

รูปแบบ JSON ถ้าไม่ใช่อาหาร:
{
  "isFood": false,
  "imageSubject": "แมว",
  "imageCaption": "แมวนั่งอยู่บนพื้น",
  "kcal": 0,
  "menuName": "",
  "carb": 0,
  "protein": 0,
  "fat": 0,
  "confidence": "high"
}
`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "ดูภาพนี้ก่อนว่าเป็นอาหารหรือเครื่องดื่มที่คนกิน/ดื่มได้ไหม ถ้าเป็นเครื่องดื่ม เช่น โค้ก น้ำอัดลม ชานม กาแฟ โกโก้ ให้ถือว่าเป็นอาหารได้และประเมินแคล ถ้าเห็นแบรนด์หรือชื่อสินค้าชัด เช่น Moccona, Nescafe, Birdy, Coke, Pepsi, Milo, Ovaltine ให้คืน brandName มาด้วย และถ้าเป็นสินค้ากาแฟ/เครื่องดื่มแบบแพ็ก ให้คืน productType กับ packagedState ด้วย ถ้าไม่ใช่อาหาร/เครื่องดื่มให้บอก imageSubject ว่าเป็นอะไร และใส่ imageCaption เป็นคำบรรยายสั้น ๆ ว่าเห็นอะไร/กำลังทำอะไร ถ้าเป็นอาหาร/เครื่องดื่มให้ประเมิน kcal, carb, protein, fat เป็นตัวเลขหน่วยกรัม และตั้งชื่อเมนูให้ตรงภาพที่สุด",
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
