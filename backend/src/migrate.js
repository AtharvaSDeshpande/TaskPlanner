import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { Organization } from './models/Organization.js';
import { Semester } from './models/Semester.js';
import { Course } from './models/Course.js';

// One-time backfill for the semesters/courses refactor:
//   • ensure every org has an active semester
//   • turn each legacy free-text assignment.course string into a Course doc and
//     point the assignment at it + the active semester
//   • stamp existing groups with the active semester
// Uses the raw driver for legacy reads so the changed schema's casting can't
// reject the old string values. Safe to run multiple times (idempotent).
function codeFromTitle(title) {
  const initials = (String(title).match(/\b[A-Za-z]/g) || ['C']).join('').toUpperCase().slice(0, 4);
  return `${initials || 'GEN'}${Math.floor(100 + Math.random() * 900)}`;
}

async function run() {
  await connectDB();
  const db = mongoose.connection.db;
  const orgs = await Organization.find();
  let migratedAssignments = 0;
  let createdCourses = 0;
  let migratedGroups = 0;

  for (const org of orgs) {
    // 1. Active semester
    let sem = await Semester.findOne({ organization: org._id, isActive: true });
    if (!sem) {
      sem = await Semester.create({ organization: org._id, name: 'Current', isActive: true });
    }

    // 2. Assignments — backfill course ref + semester
    const rawAssignments = await db
      .collection('assignments')
      .find({ organization: org._id })
      .toArray();
    const courseByTitle = new Map();

    for (const a of rawAssignments) {
      const needsCourse = typeof a.course === 'string';
      const needsSemester = !a.semester;
      if (!needsCourse && !needsSemester) continue;

      let courseId = a.course;
      if (needsCourse) {
        const title = (a.course && a.course.trim()) || 'General';
        let course = courseByTitle.get(title);
        if (!course) {
          course = await Course.findOne({ semester: sem._id, title });
          if (!course) {
            course = await Course.create({
              organization: org._id,
              semester: sem._id,
              code: codeFromTitle(title),
              title,
              program: a.program || '',
            });
            createdCourses += 1;
          }
          courseByTitle.set(title, course);
        }
        courseId = course._id;
      }

      await db
        .collection('assignments')
        .updateOne({ _id: a._id }, { $set: { course: courseId, semester: sem._id } });
      migratedAssignments += 1;
    }

    // 3. Groups — stamp the active semester
    const gRes = await db
      .collection('groups')
      .updateMany(
        { organization: org._id, semester: { $exists: false } },
        { $set: { semester: sem._id } },
      );
    migratedGroups += gRes.modifiedCount || 0;
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n[migrate] done — ${orgs.length} org(s); +${createdCourses} courses, ` +
      `${migratedAssignments} assignments, ${migratedGroups} groups backfilled.\n`,
  );
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err);
  process.exit(1);
});
