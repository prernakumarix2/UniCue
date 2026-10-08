const EPSILON = 1e-9;

export function validateCourse(input) {
  const errors = {};

  const name = String(input.name ?? "").trim();
  const code = String(input.code ?? "").trim();
  const conducted = Number(input.conducted);
  const attended = Number(input.attended);
  const target = Number(input.target);
  const dl = input.dl === undefined || input.dl === "" ? 0 : Number(input.dl);

  if (!name) errors.name = "Course name is required.";
  if (name.length > 150) errors.name = "Course name must be 150 characters or fewer.";
  if (code.length > 50) errors.code = "Course code must be 50 characters or fewer.";

  if (!Number.isInteger(conducted) || conducted < 0) {
    errors.conducted = "Classes conducted must be a non-negative integer.";
  }

  if (!Number.isInteger(attended) || attended < 0) {
    errors.attended = "Classes attended must be a non-negative integer.";
  }

  if (!Number.isInteger(dl) || dl < 0) {
    errors.dl = "Duty leave must be a non-negative integer.";
  }

  if (Number.isInteger(conducted) && Number.isInteger(attended) && attended > conducted) {
    errors.attended = "Classes attended cannot exceed classes conducted.";
  } else if (Number.isInteger(conducted) && Number.isInteger(attended) && Number.isInteger(dl) && attended + dl > conducted) {
    errors.dl = "Present plus DL cannot exceed classes conducted.";
  }

  if (!Number.isFinite(target) || target < 0 || target > 100) {
    errors.target = "Target attendance must be between 0% and 100%.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { name, code, conducted, attended, dl: Number.isInteger(dl) ? dl : 0, target }
  };
}

export function calculatePercentage(attended, conducted) {
  if (conducted === 0) return null;
  return (attended / conducted) * 100;
}

export function getAttendanceStatus(attended, conducted, target) {
  if (conducted === 0) return "Not Started";

  const percentage = calculatePercentage(attended, conducted);

  if (Math.abs(percentage - target) <= EPSILON) return "At Target";
  return percentage > target ? "Above Target" : "Below Target";
}

export function calculateAllowableAbsences(attended, conducted, target) {
  if (conducted === 0) return null;
  if (target <= 0) return Infinity;

  const current = calculatePercentage(attended, conducted);
  if (current < target) return 0;

  const t = target / 100;
  return Math.max(0, Math.floor(attended / t - conducted + EPSILON));
}

export function calculateRequiredClasses(attended, conducted, target) {
  if (conducted === 0) return target <= 0 ? 0 : null;

  const current = calculatePercentage(attended, conducted);
  if (current >= target) return 0;

  const t = target / 100;
  if (t >= 1) return Infinity;

  return Math.max(0, Math.ceil((t * conducted - attended) / (1 - t) - EPSILON));
}
