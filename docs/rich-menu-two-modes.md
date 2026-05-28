# PaeCal2 Rich Menu Two Modes

This branch adds webhook support and a setup script for the new 2-mode LINE rich menu concept.

## Required image files

Upload these files to the repository before running the setup script:

```text
assets/richmenus/paecal-richmenu-vibe.png
assets/richmenus/paecal-richmenu-cal.png
```

LINE rich menu full size is `2500 x 1686 px`.

## Rich Menu A: แปะอ่านทรง

Recommended actions:

| Button | Action |
|---|---|
| แปะอ่านทรง tab | `action=SWITCH_TO_VIBE_MENU` |
| แปะแคล › tab | switch to alias `paecal-cal-menu` with `action=SWITCH_TO_CAL_MENU` |
| ส่งรูปให้แปะอ่าน | `action=SEND_PHOTO_GUIDE` |
| วันนี้อาหารฟ้องว่า… | `action=DAILY_FOOD_WRAPPED` |
| สรุปวันนี้ | `action=DAILY_SUMMARY` |
| กินอะไรดี | `action=MEAL_SUGGESTION` |
| ฉายาวันนี้ | `action=FOOD_AURA` |

## Rich Menu B: แปะแคล

Recommended actions:

| Button | Action |
|---|---|
| ‹ แปะอ่านทรง tab | switch to alias `paecal-vibe-menu` with `action=SWITCH_TO_VIBE_MENU` |
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

## Setup command

Do not paste the LINE token into chat. Run this locally or in a trusted shell:

```bash
LINE_CHANNEL_ACCESS_TOKEN="YOUR_LINE_CHANNEL_ACCESS_TOKEN" node scripts/setup-richmenus.js
```

The script will:

1. Create the แปะอ่านทรง rich menu.
2. Upload `assets/richmenus/paecal-richmenu-vibe.png`.
3. Create the แปะแคล rich menu.
4. Upload `assets/richmenus/paecal-richmenu-cal.png`.
5. Create/update aliases:
   - `paecal-vibe-menu`
   - `paecal-cal-menu`
6. Set แปะอ่านทรง as the default rich menu.

## Manual test checklist

After running the script, open LINE and test:

- Tap `แปะแคล ›` on the vibe menu → should switch to แปะแคล.
- Tap `‹ แปะอ่านทรง` on the cal menu → should switch back to แปะอ่านทรง.
- Tap `ส่งรูปให้แปะอ่าน` → should ask user to send a food photo.
- Tap `กินอะไรดี` → should route to meal suggestion.
- Tap `สรุปวันนี้` → should show current daily summary.
- Tap `ดูแคลวันนี้` → should route to calorie summary.
- Tap `โภชนาการ` → should not break; currently routes to daily summary.
- Tap `ตั้งเป้าหมาย` → should ask for health goal.
- Tap `แก้มื้อล่าสุด` → should show edit instructions.
- Tap `ลบมื้อล่าสุด` → should delete last meal or say none found.

## Next step

After this MVP is verified, add a dedicated Food Wrapped renderer for:

- `DAILY_FOOD_WRAPPED`
- `FOOD_AURA`
- `TODAY_NUTRITION`

Those should eventually become distinct replies instead of reusing the daily summary.
