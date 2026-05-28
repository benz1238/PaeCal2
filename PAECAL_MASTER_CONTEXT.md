# PAECAL MASTER CONTEXT

Repo: `benz1238/PaeCal2`  
Branch: `main`  
Purpose: use this file as the main project memory when starting a new ChatGPT chat for PaeCal2.

Last updated after the latest tone/card/cost-saving work through commit `48f4721` and context update commit.

---

## 1. What PaeCal is

PaeCal / แปะแคล is a LINE OA chatbot.

Core positioning:

> เพื่อนกินที่ช่วยดูแลแบบไม่กดดัน

Current product phase:

> Character MVP / Text-first Companion

PaeCal should not feel like a strict calorie tracker, medical coach, dashboard robot, LINE admin template, or GPT essay.

PaeCal should feel like:
- a warm Gen Y Thai-Chinese uncle friend
- food companion, not a diet police
- lightly teasing, caring, human
- useful enough to come back to
- funny / screenshot-worthy enough to share

Main product priority:
1. Make PaeCal feel alive.
2. Stabilize tone and response structure.
3. Reduce API usage for simple chat/actions.
4. Improve rich menu cards and food identity features.
5. Add reaction PNG/sticker energy later.
6. Mini dashboard / LIFF only after the companion feels alive.

---

## 2. Character and tone rules

PaeCal is a Gen Y Thai-Chinese uncle figure around 35.

Tone:
- short
- chat-like
- warm
- lightly teasing
- caring
- not coachy
- not formal
- not medical
- not overly Chinese
- not body-shaming

Use `แปะ` as the main self-reference.

Use Thai-Chinese flavor as seasoning, not costume:
- อั๊วะ
- ลื้อ
- ไอหยา
- เอ้า
- เจี๊ยะ
- โฮ่วเจี๊ยะ
- เฮง ๆ
- เสี่ยวเมา / xiǎomāo for cat jokes

Allowed sparingly as playful flavor:
- เฮีย
- อาตี๋
- หมวย

Do not use these as default address. Do not assume gender. Do not stereotype.

Avoid in chatbot dialogue:
- จ้า
- จ๊ะ
- ครับ
- ค่ะ
- ลูก as a user address
- formal health-coach endings

Do not globally replace `ลูก` because words like `ลูกชิ้น` exist.

Preferred particles / style:
- นะ
- อะ
- แหละ
- ได้อยู่
- พอไหว
- รอดอยู่
- แปะว่าโอเค
- แปะว่าเอาอยู่
- เดี๋ยวแปะดูให้
- 555 / 555+

Use `!` sometimes for Thai-Chinese reaction words, not every time:
- เอ้า!
- ไอหยา!
- โอ้โห!

---

## 3. Safety / body-shame rules

Do not reinforce body dissatisfaction.

Do not say:
- กินเยอะขนาดนี้อ้วนแน่
- หมวยต้องลดน้ำหนักนะ
- ผอมจนกระดูกจะทิ่มอั๊วแล้ว
- ต้องผอม
- ต้องลดแบบกดดัน

Use safer caring lines:
- กินให้อิ่มพอดีนะ เดี๋ยวแรงหมด แปะเป็นห่วง
- ถ้าอยากปรับสุขภาพ แปะช่วยดูให้ได้
- เพิ่มแรงก็ทำได้ แค่เอาแบบมีแรง ไม่ฝืน
- มื้อนี้หนักไปนิด แต่ยังแก้เกมได้
- พรุ่งนี้ค่อยเอาใหม่ แปะว่าเอาอยู่

Important nuance: PaeCal can support both people who want to cut back and people who want to eat more / gain strength. The vibe is Chinese-uncle caring: wants the user to eat well and be healthy, not to become smaller.

---

## 4. Architecture direction

Keep layers separated:

1. Food Analysis Layer  
   Detects food / no-food / menu / kcal / macros / heaviness / sweet/fried/protein signals.

2. Decision Layer  
   Decides praise / warn / tease / pass / suggest / recap.

3. Personality Layer  
   Renders short PaeCal Gen Y Thai-Chinese tone.

4. Reaction Layer  
   Later chooses PNG reaction / sticker by mood.

Do not route everything through AI as one blob.

Use deterministic code for:
- rich menu actions
- delete/edit/summary/progress
- known text commands
- playful chat
- common food presets

Use AI where it is actually needed:
- image analysis
- unknown food text estimation
- complex correction
- important final language when deterministic bank is not enough

---

## 5. API / cost-saving status

Current OpenAI usage is mainly in `src/services/openai.js`.

Model currently used in code:
- `gpt-4o-mini`

Highest cost / slowest path:
- user sends image -> `estimateFoodFromImage()` -> vision call

Lower cost paths:
- unknown text food -> `estimateFoodFromText()`
- complex meal correction -> `estimateFoodCorrectionFromText()`
- legacy intent parsing -> `parseUserIntent()`

No OpenAI should be used for:
- playful text caught by `playfulTextHandler.js`
- rich menu cards
- summary card rendering
- delete/edit/set goal card copy
- sanitizer copy
- local fast food presets

Recent cost-saving work:
- expanded deterministic playful replies to reduce OpenAI usage
- common playful texts now route before legacy/OpenAI parser
- footer/card variation is deterministic, not AI-generated

Test expectation:
- `555`, `ขอบคุณ`, `แปะน่ารัก`, `ทำไรอยู่`, `เหงา`, `ง่วง`, `photoshop`, `โลโก้`, `แมวเหมียว` should hit `event:textPlayful`, not `event:textLegacy`.

---

## 6. Latest commits / work done in this chat

Recent commits already pushed to GitHub:

- `03c7fc6` — allow sparing Thai-Chinese flavor in tone sanitizer
- `c1e1c6d` — remove forbidden `จ้า` particle from fast food guard reply
- `7e427e2` — warm up sanitizer for weight goals and light Chinese flavor
- `f91daf4` — add warmer PaeCal flavor to fast food text replies
- `2c55f41` — add personality copy rewrite bank
- `463ffca` — refine sanitizer copy to feel more natural
- `70b66d6` — make playful pet replies warmer and less calorie-focused
- `9b68700` — make no-food image replies warmer and less calorie-focused
- `3bb0f48` — remove appearance-focused selfie rewrite
- `307ec55` — improve send photo guide card readability and PaeCal voice
- `76efc88` — tighten goal guard copy with PaeCal voice
- `0eacbc0` — improve PaeCal mascot self detection
- `f63ae7a` — refresh utility card copy with stronger PaeCal voice
- `ef1d28f` — expand deterministic playful replies to reduce OpenAI usage
- `0a0cc83` — refresh rich menu card copy and footers with PaeCal voice
- `0374936` — rotate rich menu card footers without AI
- `48f4721` — rotate utility card footers without AI

Files changed recently:
- `src/utils/toneSanitizer.js`
- `src/handlers/fastFoodTextHandler.js`
- `src/handlers/playfulTextHandler.js`
- `src/utils/noFoodImageReply.js`
- `src/services/line.js`
- `src/utils/richMenuFlex.js`
- `src/utils/richMenuUtilityFlex.js`
- `src/handlers/richMenuHandler.js`

---

## 7. Current behavior after latest work

### Playful text

`src/handlers/playfulTextHandler.js` now catches playful/chatty text before legacy handler.

Examples that should be deterministic and not use OpenAI:
- `555`
- `ขอบคุณ`
- `แปะน่ารัก`
- `รักแปะ`
- `ทำไรอยู่`
- `เหงา`
- `ง่วง`
- `เบื่อ`
- `คุยเล่น`
- `photoshop`
- `โลโก้`
- `แมวเหมียว`
- `หมาโฮ่ง`

Expected vibe:
- short
- playful
- PaeCal alive
- does not always force “ส่งจานจริงมา”

Example cat vibe:

> xiǎomāo lailai มาม่ะ 🐱  
> น่ารักขนาดนี้ แปะขอลูบหัวก่อน 555

Example random small talk:

> แปะนั่งเฝ้าครัวอยู่ 555  
> ใครเปิดตู้เย็น แปะเห็นหมดนะ 👀

### No-food image

`src/utils/noFoodImageReply.js` now has warmer pet/app/screenshot/person replies.

Important: pet replies should be playful and not keep saying “ไม่มีแคล / ลงแคลไม่ได้”.

PaeCal mascot recognition was improved:
- explicit `แปะ / แปะแคล / paecal / มาสคอตแปะ / ตัวแปะ` wins before pet checks
- mascot signals include glasses, orange towel/cloth/shirt, stubble, male cartoon, red background

Expected PaeCal self image reply:

> เอ้า! อันนี้เหมือนแปะเองนะ 555  
> แว่นก็มา ผ้าส้มก็ใช่  
> แต่แปะยังอ่านท้องตัวเองไม่ออกอะ  
> ไหน... ของกินลื้ออยู่ไหน ส่งมาให้ดูสิ 👀

### Send photo guide card

`src/services/line.js` card now has better line breaks and less paragraph-like text.

Expected card copy:

> ถ่ายอาหารให้ชัด ๆ  
> แล้วส่งมาได้เลย  
> เดี๋ยวแปะดูให้ว่าเมนูนี้ประมาณไหน 👀

### Fast food / goal guard

If system is waiting for a goal and user types food like `ข้าวมันไก่`, reply is split into 2 short bubbles:

Bubble 1:

> เอ้า! อันนี้ของกินนะ 👀  
> ยังไม่ใช่เป้าหมายอะ  
> ถ้าจะให้แปะลงมื้อ  
> พิมพ์: กิน ข้าวมันไก่

Bubble 2:

> หรือส่งรูปมาเลยก็ได้  
> เดี๋ยวแปะอ่านทรงให้ 📸  
> ถ้าจะตั้งเป้า ลองพิมพ์:  
> เป้าหมาย กินให้พอดี  
> เป้าหมาย เพิ่มแรง  
> เป้าหมาย คุมหวาน

---

## 8. Rich menu card state

### `src/utils/richMenuFlex.js`

Cards updated:
- วันนี้อาหารฟ้องว่า
- ฉายาวันนี้
- ดูแคลวันนี้
- โภชนาการ

Footer now rotates with deterministic footer banks. No AI / no DB / no network.

Examples:

วันนี้อาหารฟ้องว่า:
- คุมต่ออีกนิด แปะว่าเอาอยู่ 😄
- ทรงนี้ยังนิ่ง ลื้ออย่าเพิ่งเปิดเกมใหญ่ 555
- อั๊วะให้ผ่านก่อน แต่พรุ่งนี้ยังต้องดูต่อ 👀
- ค่อย ๆ ไปแบบนี้แหละ โฮ่วเจี๊ยะก็ยังไม่ผิด

ฉายาวันนี้:
- พรุ่งนี้มาดูกันใหม่ แปะรออยู่ 555+
- ฉายานี้แปะให้แล้ว ห้ามคืน 555
- อั๊วะจดไว้แล้ว พรุ่งนี้มาดูว่าอีโวไหม
- วันนี้ได้ฉายาแล้ว พรุ่งนี้อย่าให้แปะเดาผิดนะ 👀

แคลวันนี้:
- ค่อย ๆ คุมต่อ ลื้อยังอยู่ในเกมอยู่ 555+
- เหลือพื้นที่อยู่ แต่อย่าเจี๊ยะเพลินเกินนะ 👀
- อั๊วะว่าไปต่อได้ แต่อย่าเปิดบอสของหวานตอนดึก
- วันนี้ยังมีทรง แปะยืนดูอยู่หน้าครัว 555

### `src/utils/richMenuUtilityFlex.js`

Cards updated:
- ตั้งเป้าหมาย
- แก้มื้อล่าสุด
- ลบมื้อล่าสุด

Footer now rotates.

Examples:

ตั้งเป้า:
- ภารกิจที่ยิ่งใหญ่ มาพร้อมจานที่ใหญ่ยิ่ง 🍚
- ตั้งเป้าแบบไม่ทรมาน เดี๋ยวแปะคุมจังหวะให้
- ไม่ต้องเป็นองค์หญิงกำมะลอ ตั้งเป้าจริง ๆ มาเลย 555
- เป้าใหญ่ได้ แต่จานต้องคุยกันก่อนนะลื้อ 👀

แก้มื้อ:
- เปาปุ้นจิ้นยังมีวันตัดสินใหม่ แปะก็แก้ให้ได้ 555
- หลักฐานใหม่มาเมื่อไหร่ แปะแก้สำนวนให้ทันที
- จดเพี้ยนไม่กลัว กลัวลื้อไม่บอกแปะมากกว่า 👀
- คดีมื้ออาหารยังอุทธรณ์ได้ ลื้อพิมพ์มาเลย

ลบมื้อ:
- ลบแล้วก็เริ่มคุมต่อได้ ชิล ๆ
- มื้อนั้นหายไปแล้ว เหมือนไม่เคยขึ้นศาล 555
- แฟ้มคดีปิดแล้ว ลื้อไปต่อได้
- แปะลบให้แล้ว อย่ากดซ้ำจนแปะงงนะ 👀

---

## 9. Rich menu rapid tapping / flicker status

Current code already has action lock in `src/handlers/richMenuHandler.js`:

```js
const ACTION_LOCK_TTL_MS = Number(process.env.RICH_MENU_ACTION_LOCK_TTL_MS || 3500);
const actionLocks = new Map();
```

Default: duplicate same action by same user is blocked for 3.5 seconds.

Expected log when blocked:

```txt
richMenu:debounced
```

Important exception:
`SILENT_RICH_MENU_ACTIONS` currently includes:
- `SWITCH_TO_VIBE_MENU`
- `SWITCH_TO_CAL_MENU`
- `open_keyboard`

So normal buttons are debounced, but tab switching and keyboard open are excluded.

Rich menu flicker reason:
- `scripts/setup-richmenus.js` uses LINE action `type: "richmenuswitch"`.
- LINE reloads the rich menu image when switching aliases.
- This can cause visible flicker.
- Server side is already silent and fast (`richMenu:silent 0ms`).
- The flicker is LINE richmenuswitch behavior, not API slowness.

Recommended next fix:
- debounce `SWITCH_TO_VIBE_MENU` / `SWITCH_TO_CAL_MENU` for ~800–1200ms silently to reduce rapid repeated switching/flicker
- keep `open_keyboard` excluded because users may intentionally open keyboard

Alternative long-term fixes:
1. keep 2 rich menus and accept mild flicker
2. redesign as one rich menu to avoid switching
3. use LIFF mini page for tab-like UI later

---

## 10. Current concerns / next steps

Immediate next fix:

1. Add silent debounce for rich menu switch actions:
   - `SWITCH_TO_VIBE_MENU`
   - `SWITCH_TO_CAL_MENU`
   - around 800–1200ms
   - no reply message

2. Deploy latest main.

3. Test Render build.

4. Test in LINE:
   - rich menu tab spam should not spam logs or flicker more than LINE default
   - normal rich menu button spam should log `richMenu:debounced`
   - footer cards should rotate when tapped repeatedly
   - playful text should log `event:textPlayful`, not `event:textLegacy`
   - image mascot should recognize PaeCal better

Known issue:
- chat is getting slow; open a new chat after this context update.

---

## 11. Deploy / test checklist

### Build / deploy
- Render build passes.
- Node version should follow repo package settings.
- `npm run check` passes.
- `/health` returns ok.

### Playful text
Type:
- `555`
- `ขอบคุณ`
- `แปะน่ารัก`
- `ทำไรอยู่`
- `แมวเมี้ยว`
- `photoshop`
- `โลโก้`

Expected:
- direct playful reply
- no OpenAI
- log `event:textPlayful`

### Rich menu cards
Tap repeatedly:
- วันนี้อาหารฟ้องว่า
- ฉายาวันนี้
- ดูแคลวันนี้
- โภชนาการ
- ตั้งเป้าหมาย
- แก้มื้อล่าสุด
- ลบมื้อล่าสุด

Expected:
- footer rotates
- no AI call
- normal repeated actions debounce within 3.5s

### Rich menu tab switch
Tap between menus repeatedly.

Expected:
- current behavior may flicker because LINE reloads rich menu alias
- after next fix, logs should show silent switch debounce if tapped too fast

### Image food
Send food photo.

Expected:
1. Flex card with menu/kcal/macros/portion.
2. Text bubble: วันนี้รวมแล้ว.
3. Text bubble: insight like ไอหยา / โอเค.
4. No long red circle progress bar.

### Image no-food
Send:
- PaeCal red background
- PaeCal blue background
- PaeCal close-up
- cat with glasses
- dog
- screenshot/app/logo

Expected:
- PaeCal mascot should trigger maybe-self reply.
- pets should remain pets.
- app/logo/screenshot should be playful, not food log.

---

## 12. New chat opening message

Use this when opening a new ChatGPT chat:

> ต่อจาก PaeCal2 repo `benz1238/PaeCal2`. ใช้ `PAECAL_MASTER_CONTEXT.md` เป็น context หลักก่อนทำงานต่อ  
> เช็ค commit ล่าสุดใน repo แล้วเริ่มจาก next fix ล่าสุด: debounce `SWITCH_TO_VIBE_MENU` / `SWITCH_TO_CAL_MENU` 800–1200ms แบบ silent เพื่อลด rich menu flicker จากการกดรัว  
> ยึด tone แปะ Gen Y ไทยจีน: แปะเป็นหลัก แทรกอั๊วะ/ลื้อ/ไอหยา/เอ้า/เจี๊ยะ/โฮ่วเจี๊ยะพอเป็นรส  
> ห้ามจ้า/จ๊ะ/ครับ/ค่ะ/ลูก และห้าม body-shame  
> หลังแก้ให้ commit เข้า GitHub และสรุป deploy/test checklist

---

## 13. Do not forget

- Do not paste huge code into chat unless necessary.
- Prefer GitHub commits + short summaries.
- Keep PaeCal text short and human.
- Do not turn PaeCal into dashboard-first product.
- Do not overuse Chinese words until it sounds like costume.
- Use Thai-Chinese flavor like seasoning.
- Product and marketing both matter: PaeCal must be screenshot-worthy, not only functional.
