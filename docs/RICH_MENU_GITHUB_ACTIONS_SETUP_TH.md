# PaeCal Rich Menu GitHub Actions Setup

แพ็กนี้เอาไว้สำหรับตั้งค่า Rich Menu ผ่าน GitHub หน้าเว็บล้วน ๆ
ไม่ต้องเปิด Terminal และไม่ต้องรันคำสั่งบนเครื่องตัวเอง

## ไฟล์ในแพ็กนี้

- `.github/workflows/setup-rich-menu.yml`
- `scripts/setup-rich-menu-paelaew.js`
- `scripts/rich-menu-layout.paecal.json`

## สิ่งที่ต้องมี

1. โค้ด webhook ฝั่งแปะแคลที่รองรับ postback อยู่แล้ว
2. ภาพ rich menu ขนาด 2500 x 1686 px
3. LINE Channel Access Token

## ต้องเอาไฟล์ไปวางตรงไหนใน GitHub

### 1) วาง workflow

ไฟล์นี้ต้องอยู่ตาม path นี้เป๊ะ:

`.github/workflows/setup-rich-menu.yml`

### 2) วาง script

ไฟล์นี้ต้องอยู่ตาม path นี้:

`scripts/setup-rich-menu-paelaew.js`

### 3) วาง layout JSON

ไฟล์นี้ต้องอยู่ตาม path นี้:

`scripts/rich-menu-layout.paecal.json`

### 4) อัปโหลดภาพ rich menu

แนะนำให้อัปโหลดไว้ที่:

`assets/richmenu.png`

ถ้ายังไม่มีโฟลเดอร์ `assets` ให้สร้างใหม่ใน GitHub ได้เลย

---

## ขั้นตอนทำบน GitHub แบบละเอียด

### STEP A — อัปโหลดไฟล์เข้าระบบ

1. เข้า repo `PaeCal2`
2. กด `Add file` > `Upload files`
3. อัปโหลดไฟล์จากแพ็กนี้ให้ครบ
4. ถ้ายังไม่มีโฟลเดอร์ `.github/workflows` หรือ `scripts` หรือ `assets` ให้สร้าง path ตามชื่อโฟลเดอร์นั้น
5. อัปโหลดรูป rich menu ไปที่ `assets/richmenu.png`
6. Commit changes

---

### STEP B — ใส่ LINE token ใน GitHub Secrets

1. เข้า repo `PaeCal2`
2. กด `Settings`
3. เมนูซ้ายกด `Secrets and variables` > `Actions`
4. กด `New repository secret`
5. ตั้งชื่อว่า:

`LINE_CHANNEL_ACCESS_TOKEN`

6. เอา token ของ LINE OA มาใส่ค่า secret
7. กด Save

> Token หาได้จาก LINE Developers > Messaging API channel > Messaging API > Channel access token

---

### STEP C — รัน workflow

1. เข้าแท็บ `Actions`
2. เลือก workflow ชื่อ `Setup PaeCal Rich Menu`
3. กด `Run workflow`
4. กรอกค่าแบบนี้:

- `image_path` = `assets/richmenu.png`
- `layout_path` = `scripts/rich-menu-layout.paecal.json`
- `delete_old` = `true`
- `set_default` = `true`

5. กด `Run workflow`

---

## ถ้ารันสำเร็จ จะเกิดอะไรขึ้น

- rich menu เก่าจะถูกลบ (ถ้าเลือก `delete_old=true`)
- rich menu ใหม่จะถูกสร้าง
- ภาพจะถูกอัปโหลดเข้า rich menu
- rich menu ใหม่จะถูกตั้งเป็น default

---

## ตอนนี้ปุ่มถูกตั้งค่าอะไรไว้บ้าง

ไฟล์ `scripts/rich-menu-layout.paecal.json` ตั้งค่า default ไว้แบบนี้

- ปุ่มใหญ่ซ้ายบน = `postback: action=OPEN_PAELAEW_GUIDE`
- ปุ่มอื่น ๆ = ใช้ text action ตามข้อความในไฟล์ JSON

จุดสำคัญคือปุ่ม `แปะเลย` ต้องเป็น `postback` เพื่อไม่ให้ขึ้น bubble เขียวฝั่ง user

---

## ถ้ากดแล้วพื้นที่ไม่ตรงกับภาพ

แปลว่า layout ในไฟล์:

`scripts/rich-menu-layout.paecal.json`

ยังไม่ตรงกับภาพ rich menu ของจริง

ตอนนั้นให้ส่งภาพ rich menu มาอีกที แล้วค่อยปรับพิกัดใน JSON ให้ตรง

---

## Layout ที่แพ็กนี้ใช้ตอนเริ่มต้น

ขนาด canvas: `2500 x 1686`

มี 8 โซนตามค่า default ในไฟล์ JSON

ถ้าภาพของคุณไม่ได้ใช้ layout นี้ตรง ๆ ต้องปรับพิกัดโซนใน JSON

---

## หมายเหตุสำคัญ

- แพ็กนี้ทำงานผ่าน GitHub Actions ไม่ต้องใช้คอมมานด์ไลน์
- ต้องมี `LINE_CHANNEL_ACCESS_TOKEN` ใน GitHub Secrets ก่อนเสมอ
- ถ้า webhook ของบอทยังไม่รองรับ postback แม้ rich menu จะสร้างสำเร็จ แต่กดปุ่มแล้วอาจยังไม่ขึ้นการ์ด
