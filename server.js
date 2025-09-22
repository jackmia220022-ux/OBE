const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

const initialData = {
  programs: [],
  semesters: [],
  courses: [],
  students: [],
  enrolments: [],
  programOutcomes: [],
  courseOutcomes: [],
  coPoMappings: [],
  assessments: [],
  assessmentCoMappings: [],
  marks: [],
  courseReports: []
};

class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateId() {
  return `id-${crypto.randomBytes(8).toString('hex')}${Date.now().toString(16)}`;
}

class DataStore {
  constructor(filePath, seed) {
    this.filePath = filePath;
    this.seed = clone(seed);
    this.data = clone(seed);
  }

  async init() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = clone(this.seed);
      for (const key of Object.keys(this.seed)) {
        if (Array.isArray(parsed[key])) {
          this.data[key] = parsed[key];
        }
      }
      await this.save();
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.save();
      } else {
        throw error;
      }
    }
  }

  async save() {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getAll() {
    return clone(this.data);
  }

  list(collection) {
    if (!Object.prototype.hasOwnProperty.call(this.data, collection)) {
      throw new ValidationError(`Unknown collection: ${collection}`, 404);
    }
    return clone(this.data[collection]);
  }

  findById(collection, id) {
    return this.data[collection].find((item) => item.id === id);
  }

  async addProgram(payload) {
    const code = (payload.code || '').trim();
    const name = (payload.name || '').trim();
    const description = (payload.description || '').trim();

    if (!code || !name) {
      throw new ValidationError('Program code and name are required.');
    }

    const exists = this.data.programs.some(
      (program) => program.code.toLowerCase() === code.toLowerCase()
    );

    if (exists) {
      throw new ValidationError('A program with this code already exists.', 409);
    }

    const program = { id: generateId(), code, name, description };
    this.data.programs.push(program);
    await this.save();
    return program;
  }

  async addSemester(payload) {
    const name = (payload.name || '').trim();
    const sequence = Number(payload.sequence);

    if (!name || Number.isNaN(sequence)) {
      throw new ValidationError('Semester name and sequence are required.');
    }

    const semester = { id: generateId(), name, sequence };
    this.data.semesters.push(semester);
    await this.save();
    return semester;
  }

  async addCourse(payload) {
    const code = (payload.code || '').trim();
    const name = (payload.name || '').trim();
    const programId = payload.programId;
    const semesterId = payload.semesterId;
    const credits = Number(payload.credits);

    if (!code || !name || !programId || !semesterId || Number.isNaN(credits)) {
      throw new ValidationError('Course code, name, program, semester and credits are required.');
    }

    if (!this.findById('programs', programId)) {
      throw new ValidationError('Referenced program does not exist.');
    }

    if (!this.findById('semesters', semesterId)) {
      throw new ValidationError('Referenced semester does not exist.');
    }

    const course = { id: generateId(), code, name, programId, semesterId, credits };
    this.data.courses.push(course);
    await this.save();
    return course;
  }

  async addStudent(payload) {
    const studentId = (payload.studentId || '').trim();
    const name = (payload.name || '').trim();
    const email = (payload.email || '').trim();
    const programId = payload.programId;

    if (!studentId || !name || !programId) {
      throw new ValidationError('Student ID, name and program are required.');
    }

    if (!this.findById('programs', programId)) {
      throw new ValidationError('Referenced program does not exist.');
    }

    const existing = this.data.students.some(
      (student) => student.studentId.toLowerCase() === studentId.toLowerCase()
    );

    if (existing) {
      throw new ValidationError('A student with this ID already exists.', 409);
    }

    const student = { id: generateId(), studentId, name, email, programId };
    this.data.students.push(student);
    await this.save();
    return student;
  }

  async addEnrolment(payload) {
    const studentId = payload.studentId;
    const courseId = payload.courseId;
    const semesterId = payload.semesterId;
    const year = (payload.year || '').trim();

    if (!studentId || !courseId || !semesterId || !year) {
      throw new ValidationError('Student, course, semester and academic year are required.');
    }

    if (!this.findById('students', studentId)) {
      throw new ValidationError('Referenced student does not exist.');
    }

    if (!this.findById('courses', courseId)) {
      throw new ValidationError('Referenced course does not exist.');
    }

    if (!this.findById('semesters', semesterId)) {
      throw new ValidationError('Referenced semester does not exist.');
    }

    const composite = `${studentId}|${courseId}|${semesterId}|${year}`;
    const exists = this.data.enrolments.some((enrolment) => {
      return `${enrolment.studentId}|${enrolment.courseId}|${enrolment.semesterId}|${enrolment.year}` === composite;
    });

    if (exists) {
      throw new ValidationError('Enrolment already exists for the provided student, course, semester and year.', 409);
    }

    const enrolment = { id: generateId(), studentId, courseId, semesterId, year };
    this.data.enrolments.push(enrolment);
    await this.save();
    return enrolment;
  }

  async addProgramOutcome(payload) {
    const programId = payload.programId;
    const code = (payload.code || '').trim();
    const description = (payload.description || '').trim();

    if (!programId || !code) {
      throw new ValidationError('Program and outcome code are required.');
    }

    if (!this.findById('programs', programId)) {
      throw new ValidationError('Referenced program does not exist.');
    }

    const composite = `${programId}|${code.toLowerCase()}`;
    const exists = this.data.programOutcomes.some((outcome) => {
      return `${outcome.programId}|${outcome.code.toLowerCase()}` === composite;
    });

    if (exists) {
      throw new ValidationError('An outcome with this code already exists for the program.', 409);
    }

    const programOutcome = { id: generateId(), programId, code, description };
    this.data.programOutcomes.push(programOutcome);
    await this.save();
    return programOutcome;
  }

  async addCourseOutcome(payload) {
    const courseId = payload.courseId;
    const code = (payload.code || '').trim();
    const description = (payload.description || '').trim();

    if (!courseId || !code) {
      throw new ValidationError('Course and outcome code are required.');
    }

    if (!this.findById('courses', courseId)) {
      throw new ValidationError('Referenced course does not exist.');
    }

    const composite = `${courseId}|${code.toLowerCase()}`;
    const exists = this.data.courseOutcomes.some((outcome) => {
      return `${outcome.courseId}|${outcome.code.toLowerCase()}` === composite;
    });

    if (exists) {
      throw new ValidationError('An outcome with this code already exists for the course.', 409);
    }

    const courseOutcome = { id: generateId(), courseId, code, description };
    this.data.courseOutcomes.push(courseOutcome);
    await this.save();
    return courseOutcome;
  }

  async addCoPoMapping(payload) {
    const courseOutcomeId = payload.courseOutcomeId;
    const programOutcomeId = payload.programOutcomeId;
    const weight = Number(payload.weight);

    if (!courseOutcomeId || !programOutcomeId || Number.isNaN(weight)) {
      throw new ValidationError('Course outcome, program outcome and weight are required.');
    }

    if (!this.findById('courseOutcomes', courseOutcomeId)) {
      throw new ValidationError('Referenced course outcome does not exist.');
    }

    if (!this.findById('programOutcomes', programOutcomeId)) {
      throw new ValidationError('Referenced program outcome does not exist.');
    }

    const composite = `${courseOutcomeId}|${programOutcomeId}`;
    const exists = this.data.coPoMappings.some((mapping) => {
      return `${mapping.courseOutcomeId}|${mapping.programOutcomeId}` === composite;
    });

    if (exists) {
      throw new ValidationError('The CO and PO are already mapped.', 409);
    }

    const mapping = { id: generateId(), courseOutcomeId, programOutcomeId, weight };
    this.data.coPoMappings.push(mapping);
    await this.save();
    return mapping;
  }

  async addAssessment(payload) {
    const courseId = payload.courseId;
    const name = (payload.name || '').trim();
    const type = (payload.type || '').trim();
    const maxMarks = Number(payload.maxMarks);
    const semesterId = payload.semesterId;

    if (!courseId || !name || !type || Number.isNaN(maxMarks) || !semesterId) {
      throw new ValidationError('Assessment course, name, type, max marks and semester are required.');
    }

    if (!this.findById('courses', courseId)) {
      throw new ValidationError('Referenced course does not exist.');
    }

    if (!this.findById('semesters', semesterId)) {
      throw new ValidationError('Referenced semester does not exist.');
    }

    const assessment = { id: generateId(), courseId, name, type, maxMarks, semesterId };
    this.data.assessments.push(assessment);
    await this.save();
    return assessment;
  }

  async addAssessmentCoMapping(payload) {
    const assessmentId = payload.assessmentId;
    const courseOutcomeId = payload.courseOutcomeId;
    const weight = Number(payload.weight);

    if (!assessmentId || !courseOutcomeId || Number.isNaN(weight)) {
      throw new ValidationError('Assessment, course outcome and weight are required.');
    }

    if (!this.findById('assessments', assessmentId)) {
      throw new ValidationError('Referenced assessment does not exist.');
    }

    if (!this.findById('courseOutcomes', courseOutcomeId)) {
      throw new ValidationError('Referenced course outcome does not exist.');
    }

    const composite = `${assessmentId}|${courseOutcomeId}`;
    const exists = this.data.assessmentCoMappings.some((mapping) => {
      return `${mapping.assessmentId}|${mapping.courseOutcomeId}` === composite;
    });

    if (exists) {
      throw new ValidationError('The assessment and course outcome are already mapped.', 409);
    }

    const mapping = { id: generateId(), assessmentId, courseOutcomeId, weight };
    this.data.assessmentCoMappings.push(mapping);
    await this.save();
    return mapping;
  }

  async upsertMark(payload) {
    const enrolmentId = payload.enrolmentId;
    const assessmentId = payload.assessmentId;
    const marks = Number(payload.marks);

    if (!enrolmentId || !assessmentId || Number.isNaN(marks)) {
      throw new ValidationError('Enrolment, assessment and marks are required.');
    }

    if (!this.findById('enrolments', enrolmentId)) {
      throw new ValidationError('Referenced enrolment does not exist.');
    }

    if (!this.findById('assessments', assessmentId)) {
      throw new ValidationError('Referenced assessment does not exist.');
    }

    let entry = this.data.marks.find(
      (mark) => mark.enrolmentId === enrolmentId && mark.assessmentId === assessmentId
    );
    let created = false;

    if (entry) {
      entry.marks = marks;
    } else {
      entry = { id: generateId(), enrolmentId, assessmentId, marks };
      this.data.marks.push(entry);
      created = true;
    }

    await this.save();
    return { entry, created };
  }

  async upsertCourseReport(payload) {
    const courseId = payload.courseId;
    const semesterId = payload.semesterId;
    const year = (payload.year || '').trim();
    const summary = (payload.summary || '').trim();
    const actions = (payload.actions || '').trim();

    if (!courseId || !semesterId || !year) {
      throw new ValidationError('Course, semester and academic year are required.');
    }

    if (!this.findById('courses', courseId)) {
      throw new ValidationError('Referenced course does not exist.');
    }

    if (!this.findById('semesters', semesterId)) {
      throw new ValidationError('Referenced semester does not exist.');
    }

    const composite = `${courseId}|${semesterId}|${year}`;
    let entry = this.data.courseReports.find((report) => {
      return `${report.courseId}|${report.semesterId}|${report.year}` === composite;
    });
    let created = false;

    if (entry) {
      entry.summary = summary;
      entry.actions = actions;
    } else {
      entry = { id: generateId(), courseId, semesterId, year, summary, actions };
      this.data.courseReports.push(entry);
      created = true;
    }

    await this.save();
    return { entry, created };
  }
}

function handleError(res, error) {
  if (error instanceof ValidationError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Unexpected error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

async function start() {
  const store = new DataStore(DATA_FILE, initialData);
  await store.init();

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname)));

  const collections = new Set(Object.keys(initialData));

  app.get('/api/data', (req, res) => {
    res.json(store.getAll());
  });

  app.get('/api/:collection', (req, res) => {
    try {
      const { collection } = req.params;
      if (!collections.has(collection)) {
        res.status(404).json({ error: 'Collection not found.' });
        return;
      }
      res.json(store.list(collection));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/programs', async (req, res) => {
    try {
      const program = await store.addProgram(req.body);
      res.status(201).json(program);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/semesters', async (req, res) => {
    try {
      const semester = await store.addSemester(req.body);
      res.status(201).json(semester);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/courses', async (req, res) => {
    try {
      const course = await store.addCourse(req.body);
      res.status(201).json(course);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/students', async (req, res) => {
    try {
      const student = await store.addStudent(req.body);
      res.status(201).json(student);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/enrolments', async (req, res) => {
    try {
      const enrolment = await store.addEnrolment(req.body);
      res.status(201).json(enrolment);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/programOutcomes', async (req, res) => {
    try {
      const programOutcome = await store.addProgramOutcome(req.body);
      res.status(201).json(programOutcome);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/courseOutcomes', async (req, res) => {
    try {
      const courseOutcome = await store.addCourseOutcome(req.body);
      res.status(201).json(courseOutcome);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/coPoMappings', async (req, res) => {
    try {
      const mapping = await store.addCoPoMapping(req.body);
      res.status(201).json(mapping);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/assessments', async (req, res) => {
    try {
      const assessment = await store.addAssessment(req.body);
      res.status(201).json(assessment);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/assessmentCoMappings', async (req, res) => {
    try {
      const mapping = await store.addAssessmentCoMapping(req.body);
      res.status(201).json(mapping);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/marks', async (req, res) => {
    try {
      const { entry, created } = await store.upsertMark(req.body);
      res.status(created ? 201 : 200).json(entry);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/courseReports', async (req, res) => {
    try {
      const { entry, created } = await store.upsertCourseReport(req.body);
      res.status(created ? 201 : 200).json(entry);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.listen(PORT, () => {
    console.log(`OBE portal server listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
