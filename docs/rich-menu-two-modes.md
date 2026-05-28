# PaeCal2 Rich Menu Two Modes

This branch adds webhook support for the new 2-mode LINE rich menu concept.

## Rich Menu A: แปะอ่านทรง

Recommended postback actions:

| Button | Postback data |
|---|---|
| แปะอ่านทรง tab | `action=SWITCH_TO_VIBE_MENU` |
| แปะแคล › tab | `action=SWITCH_TO_CAL_MENU` |
| ส่งรูปให้แปะอ่าน | `action=SEND_PHOTO_GUIDE` |
| วันนี้อาหารฟ้องว่า… | `action=DAILY_FOOD_WRAPPED` |
| สรุปวันนี้ | `action=DAILY_SUMMARY` |
| กินอะไรดี | `action=MEAL_SUGGESTION` |
| ฉายาวันนี้ | `action=FOOD_AURA` |

## Rich Menu B: แปะแคล

Recommended postback actions:

| Button | Postback data |
|---|---|
| ‹ แปะอ่านทรง tab | `action=SWITCH_TO_VIBE_MENU` |
| แปะแคล tab | `action=SWITCH_TO_CAL_MENU` |
| ดูแคลวันนี้ | `action=TODAY_CALORIES` |
| โภชนาการ | `action=TODAY_NUTRITION` |
| ตั้งเป้าหมาย | `action=SET_GOAL` |
| แก้มื้อล่าสุด | `action=EDIT_LAST_MEAL` |
| ลบมื้อล่าสุด | `action=DELETE_LAST_MEAL` |

## Current behavior in this MVP branch

The webhook maps rich menu postbacks to existing text-handler flows first, so the new menu can be connected without breaking the current bot.

- `SEND_PHOTO_GUIDE` replies with the current photo guide.
- `MEAL_SUGGESTION` routes to `กินอะไรดี`.
- `DAILY_SUMMARY`, `DAILY_FOOD_WRAPPED`, `FOOD_AURA`, and `TODAY_NUTRITION` currently route to the existing daily summary flow.
- `TODAY_CALORIES` routes to `แคลวันนี้`.
- `SET_GOAL` routes to `ตั้งเป้าสุขภาพ`.
- `EDIT_LAST_MEAL` routes to `แก้มื้อล่าสุด`.
- `DELETE_LAST_MEAL` routes to `ลบมื้อล่าสุด`.

## Next step

After this MVP is verified, add a dedicated Food Wrapped renderer for:

- `DAILY_FOOD_WRAPPED`
- `FOOD_AURA`
- `TODAY_NUTRITION`

Those should eventually become distinct replies instead of reusing the daily summary.
