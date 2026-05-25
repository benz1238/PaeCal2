# Pae-Cal Persistent Memory 7 วัน

## สถานะไฟล์ชุดนี้

ชุดนี้ทำให้ตรงกับ repo จริงที่ส่งมาแล้ว:

- `src/services/sheet.js` ใช้ `postToSheet(payload)`
- Node ส่ง action ไป Google Apps Script
- ไม่ใช้ direct adapter แบบ `getRows / appendRow / updateRow`
- ใช้ ES Module ตาม `package.json`

## ไฟล์ที่แก้/เพิ่ม

### แก้ไฟล์เดิม

- `src/utils/memory.js`
- `src/utils/decision.js`
- `src/utils/personality.js`
- `src/handlers/imageHandler.js`
- `src/handlers/textHandler.js`
- `src/check-imports.js`

### เพิ่มไฟล์ใหม่

- `src/services/memorySheet.js`
- `google-apps-script/memory-actions.patch.js`
- `docs/PERSISTENT_MEMORY_7D.md`

## Action ใหม่ที่ต้องเพิ่มใน Google Apps Script

- `UPSERT_DAILY_MEMORY`
- `GET_MEMORY_LAST_7_DAYS`

เปิดไฟล์นี้แล้ว copy helper ไปใส่ Apps Script เดิม:

`google-apps-script/memory-actions.patch.js`

จากนั้นเพิ่ม route ใน `doPost(e)` หลัง parse `data` และ `action`:

```js
if (action === "UPSERT_DAILY_MEMORY") return upsertDailyMemory_(data);
if (action === "GET_MEMORY_LAST_7_DAYS") return getMemoryLast7Days_(data);
```

## Sheet ใหม่

ระบบจะสร้าง sheet ชื่อ `MemoryDaily` อัตโนมัติ ถ้ายังไม่มี

Columns:

```txt
userId
date
totalKcal
mealCount
heavyCount
sweetCount
friedCount
proteinLowCount
lateMealCount
topFoods
moodTag
summaryText
updatedAt
```

## Flow ที่เพิ่ม

### หลัง log อาหารจากรูป

`imageHandler.js`

- log food ตามเดิม
- refresh daily memory snapshot
- ดึง 7-day memory
- ส่งเข้า `decideFoodLog`
- personality ตัดสินว่าจะพูดถึง 7-day memory หรือไม่

### หลัง log อาหารจาก text

`textHandler.js`

- log food ตามเดิม
- refresh daily memory snapshot
- ดึง 7-day memory
- ส่งเข้า `decideFoodLog`

### สรุปวันนี้ / กินไรดี

- ดึง daily summary ตามเดิม
- ดึง 7-day memory เพิ่ม
- ส่งเข้า decision/personality

## สิ่งที่ยังต้องเช็กกับ Apps Script ตัวเต็ม

เพราะรอบนี้ไม่ได้มี Apps Script ตัวเต็มแนบมา จึงยังต้องเช็ก 2 จุดก่อน deploy:

1. ตัวแปร global `ss` มีอยู่แล้วหรือไม่
2. `doPost(e)` เดิม return JSON ผ่าน `ContentService` ใช้ pattern เดียวกันหรือไม่

ถ้า Apps Script เดิมมี `jsonOutput` helper อยู่แล้ว อาจเลือกใช้ของเดิมแทน `jsonOutput_` ใน patch ได้

## คำสั่งเช็กฝั่ง Node

```bash
node --check src/line-webhook.js
node --check src/check-imports.js
node src/check-imports.js
```

ใน sandbox เช็ก syntax และ named exports ผ่านแล้ว
