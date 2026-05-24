import axios from "axios";

export const postToSheet = async (payload) => {
  const url = process.env.GOOGLE_SHEET_WEBAPP_URL;

  if (!url) {
    throw new Error("Missing GOOGLE_SHEET_WEBAPP_URL");
  }

  const res = await axios.post(url, payload);
  return res.data || {};
};
