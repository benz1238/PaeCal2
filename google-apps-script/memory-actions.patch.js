// Pae-Cal Persistent Memory 7 วัน
// วิธีใช้: วาง helper ชุดนี้ใน Google Apps Script เดิม
// แล้วเพิ่ม route 2 บรรทัดนี้ใน doPost(e) หลังอ่าน data/action แล้ว:
//
// if (action === "UPSERT_DAILY_MEMORY") return upsertDailyMemory_(data);
// if (action === "GET_MEMORY_LAST_7_DAYS") return getMemoryLast7Days_(data);

var MEMORY_DAILY_SHEET_NAME = "MemoryDaily";
var MEMORY_DAILY_HEADERS = [
  "userId",
  "date",
  "totalKcal",
  "mealCount",
  "heavyCount",
  "sweetCount",
  "friedCount",
  "proteinLowCount",
  "lateMealCount",
  "topFoods",
  "moodTag",
  "summaryText",
  "updatedAt"
];

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateMemoryDailySheet_() {
  var sheet = ss.getSheetByName(MEMORY_DAILY_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(MEMORY_DAILY_SHEET_NAME);
    sheet.appendRow(MEMORY_DAILY_HEADERS);
    return sheet;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];

  if (!existingHeaders || String(existingHeaders[0] || "") !== "userId") {
    sheet.clear();
    sheet.appendRow(MEMORY_DAILY_HEADERS);
  }

  return sheet;
}

function normalizeMemoryRow_(row) {
  return {
    userId: String(row[0] || ""),
    date: String(row[1] || ""),
    totalKcal: Number(row[2] || 0),
    mealCount: Number(row[3] || 0),
    heavyCount: Number(row[4] || 0),
    sweetCount: Number(row[5] || 0),
    friedCount: Number(row[6] || 0),
    proteinLowCount: Number(row[7] || 0),
    lateMealCount: Number(row[8] || 0),
    topFoods: String(row[9] || ""),
    moodTag: String(row[10] || ""),
    summaryText: String(row[11] || ""),
    updatedAt: String(row[12] || "")
  };
}

function upsertDailyMemory_(data) {
  var userId = String(data.userId || "");
  var date = String(data.date || "");

  if (!userId || !date) {
    return jsonOutput_({ status: "error", message: "missing userId/date" });
  }

  var sheet = getOrCreateMemoryDailySheet_();
  var values = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === userId && String(values[i][1]) === date) {
      targetRow = i + 1;
      break;
    }
  }

  var row = [
    userId,
    date,
    Number(data.totalKcal || 0),
    Number(data.mealCount || 0),
    Number(data.heavyCount || 0),
    Number(data.sweetCount || 0),
    Number(data.friedCount || 0),
    Number(data.proteinLowCount || 0),
    Number(data.lateMealCount || 0),
    String(data.topFoods || ""),
    String(data.moodTag || ""),
    String(data.summaryText || ""),
    String(data.updatedAt || new Date().toISOString())
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, MEMORY_DAILY_HEADERS.length).setValues([row]);
    return jsonOutput_({ status: "success", mode: "updated" });
  }

  sheet.appendRow(row);
  return jsonOutput_({ status: "success", mode: "inserted" });
}

function getMemoryLast7Days_(data) {
  var userId = String(data.userId || "");
  if (!userId) return jsonOutput_({ status: "error", message: "missing userId", rows: [] });

  var sheet = getOrCreateMemoryDailySheet_();
  var values = sheet.getDataRange().getValues();
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === userId) {
      rows.push(normalizeMemoryRow_(values[i]));
    }
  }

  rows.sort(function(a, b) {
    return String(a.date).localeCompare(String(b.date));
  });

  rows = rows.slice(-7);

  return jsonOutput_({ status: "success", rows: rows });
}
