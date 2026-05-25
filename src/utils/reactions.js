const REACTION_BANK = {
  fried_heavy: ["pae_tired_01", "pae_tired_02", "pae_side_eye_01"],
  protein_good: ["pae_proud_01", "pae_proud_02", "pae_thumb_01"],
  sweet_heavy: ["pae_warning_01", "pae_cry_01", "pae_side_eye_02"],
  balanced: ["pae_happy_01", "pae_happy_02", "pae_ok_01"],
  happy: ["pae_happy_01", "pae_ok_01"],
  over_calorie: ["pae_shocked_01", "pae_shocked_02", "pae_tired_01"],
  no_food_detected: ["pae_confused_01", "pae_zoom_01"],
  thinking: ["pae_thinking_01", "pae_thinking_02"],
  shocked: ["pae_shocked_01", "pae_side_eye_01"],
};

const pick = (items = []) => {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

export const chooseReaction = ({ emotion = "happy", lastReactionKey = "" } = {}) => {
  const bank = REACTION_BANK[emotion] || REACTION_BANK.happy;
  const candidates = bank.length > 1 ? bank.filter((key) => key !== lastReactionKey) : bank;
  const imageKey = pick(candidates.length ? candidates : bank);

  return {
    emotion,
    imageKey,
  };
};

export const getReactionBank = () => REACTION_BANK;
