// First-run checklist: derived from the student's real data, so it can never get out of sync.
/** { steps: [{id,title,sub,done,href,cta}], doneCount, complete } */
export function setupProgress(courses = []) {
  const withNumbers = courses.filter(c => Number(c.conducted) > 0);
  const withDate = courses.filter(c => c.lastDate);
  const firstNoNumbers = courses.find(c => !(Number(c.conducted) > 0));
  const steps = [
    { id: "courses", title: "Add your courses", sub: courses.length ? `${courses.length} added` : "Import your UMS timetable, it takes a minute", done: courses.length > 0, href: "#/attendance/import", cta: "Import timetable" },
    { id: "numbers", title: "Add your attendance numbers", sub: courses.length ? `${withNumbers.length} of ${courses.length} courses have numbers` : "Copy attended and conducted from UMS", done: courses.length > 0 && withNumbers.length === courses.length, href: firstNoNumbers ? `#/attendance/course/${encodeURIComponent(firstNoNumbers.id)}/edit` : "#/attendance", cta: "Add numbers" },
    { id: "lastdate", title: "Set your semester's last class day", sub: courses.length ? `${withDate.length} of ${courses.length} courses have a last date` : "UniCue plans around it", done: courses.length > 0 && withDate.length === courses.length, href: courses.find(c => !c.lastDate) ? `#/attendance/course/${encodeURIComponent(courses.find(c => !c.lastDate).id)}/edit` : "#/attendance", cta: "Set date" }
  ];
  const doneCount = steps.filter(s => s.done).length;
  return { steps, doneCount, complete: doneCount === steps.length };
}
