import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Organization } from './models/Organization.js';
import { Assignment } from './models/Assignment.js';
import { Semester } from './models/Semester.js';
import { Course } from './models/Course.js';
import { generatePassword } from './utils/password.js';

// Idempotently provisions:
//   1. the platform owner (from env)
//   2. a demo organization (glim.edu) with an admin, a moderator and students
//   3. sample assignments — including a section-specific one — for the demo org
async function upsertUser(spec) {
  const email = spec.email.toLowerCase();
  let user = await User.findOne({ email });
  if (user) return { user, created: false, password: null };

  user = new User({ ...spec, email });
  await user.setPassword(spec.password);
  await user.save();
  return { user, created: true, password: spec.password };
}

async function run() {
  await connectDB();
  const results = [];

  // 1. Platform owner (no organization).
  results.push(
    await upsertUser({
      name: env.owner.name,
      email: env.owner.email,
      role: 'owner',
      organization: null,
      mustChangePassword: false,
      password: env.owner.password,
    }),
  );

  // 2. Demo organization.
  const domain = 'glim.edu';
  let org = await Organization.findOne({ domain });
  if (!org) org = await Organization.create({ name: 'GLIM (Demo)', domain, status: 'active' });

  const orgId = org._id;

  results.push(
    await upsertUser({
      name: 'GLIM Admin',
      email: `admin@${domain}`,
      role: 'admin',
      organization: orgId,
      mustChangePassword: true,
      password: env.defaultOrgAdminPassword,
    }),
  );

  results.push(
    await upsertUser({
      name: 'Prof. Maya Iyer',
      email: `maya.iyer@${domain}`,
      role: 'moderator',
      organization: orgId,
      program: 'PGDM',
      mustChangePassword: true,
      password: generatePassword(12),
    }),
  );

  const students = [
    { name: 'Aarav Sharma', email: `aarav.sharma@${domain}`, program: 'PGDM', section: '1', rollNumber: 'PGDM-101' },
    { name: 'Diya Patel', email: `diya.patel@${domain}`, program: 'PGDM', section: '2', rollNumber: 'PGDM-102' },
    { name: 'Rohan Mehta', email: `rohan.mehta@${domain}`, program: 'MBA', section: '1', rollNumber: 'MBA-201' },
  ];
  for (const s of students) {
    // eslint-disable-next-line no-await-in-loop
    results.push(
      await upsertUser({
        ...s,
        role: 'student',
        organization: orgId,
        mustChangePassword: true,
        password: generatePassword(12),
      }),
    );
  }

  const admin = results[1].user;
  const maya = results[2].user;

  // 3. Active semester.
  let semester = await Semester.findOne({ organization: orgId, isActive: true });
  if (!semester) {
    semester = await Semester.create({
      organization: orgId,
      name: 'Semester 1',
      isActive: true,
      createdBy: admin._id,
    });
  }

  // 4. Courses (Maya moderates Marketing Management — subject-level moderation).
  const courseSpecs = [
    { code: 'MKT101', title: 'Marketing Management', program: 'PGDM', moderators: [maya._id] },
    { code: 'OPS101', title: 'Operations Management', program: 'PGDM', moderators: [] },
    { code: 'FIN201', title: 'Corporate Finance', program: 'MBA', moderators: [] },
  ];
  const courses = {};
  for (const c of courseSpecs) {
    // eslint-disable-next-line no-await-in-loop
    let course = await Course.findOne({ semester: semester._id, code: c.code });
    if (!course) {
      // eslint-disable-next-line no-await-in-loop
      course = await Course.create({ organization: orgId, semester: semester._id, createdBy: admin._id, ...c });
    }
    courses[c.code] = course;
  }

  // 5. Sample assignments for the active semester (only if none exist yet).
  if ((await Assignment.countDocuments({ organization: orgId, semester: semester._id })) === 0) {
    const day = 24 * 60 * 60 * 1000;
    const base = { organization: orgId, semester: semester._id, createdBy: admin._id };
    await Assignment.create([
      {
        ...base,
        title: 'Marketing Strategy Case Study',
        description: 'Submit a 2,000-word analysis of the assigned go-to-market case.',
        course: courses.MKT101._id,
        program: 'PGDM',
        sections: [],
        dueAt: new Date(Date.now() + 3 * day),
      },
      {
        ...base,
        title: 'Section 1 Pop Quiz',
        description: 'Closed-book quiz for PGDM Section 1 only.',
        course: courses.OPS101._id,
        program: 'PGDM',
        sections: ['1'],
        dueAt: new Date(Date.now() + 5 * day),
      },
      {
        ...base,
        title: 'Financial Modelling Assignment',
        description: 'Build a 3-statement DCF model for the assigned company.',
        course: courses.FIN201._id,
        program: 'MBA',
        sections: [],
        dueAt: new Date(Date.now() + 7 * day),
      },
    ]);
  }

  // eslint-disable-next-line no-console
  console.log('\n──────── Seed complete ────────');
  // eslint-disable-next-line no-console
  console.log(`  organization: ${org.name}  (@${org.domain})`);
  for (const r of results) {
    const tag = r.created ? '+' : '=';
    const pw = r.created ? `password: ${r.password}` : '(already existed)';
    // eslint-disable-next-line no-console
    console.log(`  ${tag} ${r.user.role.padEnd(9)} ${r.user.email.padEnd(28)} ${pw}`);
  }
  // eslint-disable-next-line no-console
  console.log('───────────────────────────────\n');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err);
  process.exit(1);
});
