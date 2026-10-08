export function required(value, label = "This field") {
  return String(value ?? "").trim() ? "" : `${label} is required.`;
}

export function integerInRange(value, label, min, max) {
  if (value === "" || value === null || value === undefined) return `${label} is required.`;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    return `${label} must be an integer from ${min} to ${max}.`;
  }
  return "";
}
