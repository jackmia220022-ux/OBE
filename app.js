const API_BASE = '/api';

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

let data = structuredClone(initialData);
let lastMarkViewCourseId = '';
let lastCoStudentFilter = null;
let lastCoSemesterFilter = null;
let lastPoStudentFilter = null;
let lastPoSemesterFilter = null;
let lastPoCoProgramId = null;

async function loadInitialData() {
    try {
        await reloadDataFromServer(false);
    } catch (error) {
        console.error('Unable to load data from server. Using empty state.', error);
        data = structuredClone(initialData);
        alert('Unable to reach the server. Data entry will not persist until the backend is available.');
    }
}

async function reloadDataFromServer(showAlertOnError = true) {
    const response = await fetch(`${API_BASE}/data`);
    if (!response.ok) {
        const message = `Unable to load data from server (${response.status}).`;
        if (showAlertOnError) {
            alert(message);
        }
        throw new Error(message);
    }
    const payload = await response.json();
    data = Object.assign(structuredClone(initialData), payload);
}

async function postJson(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
            const errorPayload = await response.json();
            if (errorPayload?.error) {
                errorMessage = errorPayload.error;
            }
        } catch (error) {
            // ignore JSON parse errors
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

function resetReports() {
    document.getElementById('mark-view-content').innerHTML = '<p class="empty-state">Use the filter to view uploaded marks.</p>';
    document.getElementById('co-student-report').innerHTML = '<p class="empty-state">Select a student and course to view CO attainment.</p>';
    document.getElementById('co-semester-report').innerHTML = '<p class="empty-state">Select a course and semester to view aggregated attainment.</p>';
    document.getElementById('po-student-report').innerHTML = '<p class="empty-state">Choose a student to view PO achievement.</p>';
    document.getElementById('po-semester-report').innerHTML = '<p class="empty-state">Choose a program and semester to view PO achievement.</p>';
    document.getElementById('po-co-content').innerHTML = '<p class="empty-state">Select a program to generate the mapping report.</p>';
}

function structuredClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    await loadInitialData();
    setupNavigation();
    setupForms();
    refreshSelectOptions();
    renderAllTables();
    resetReports();
}

function setupNavigation() {
    const buttons = document.querySelectorAll('.app-nav button');
    const sections = document.querySelectorAll('main section');

    function showSection(id) {
        sections.forEach(section => {
            section.classList.toggle('active', section.id === id);
        });
        buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.section === id);
        });
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            showSection(button.dataset.section);
        });
    });

    showSection('dashboard');
}

function setupForms() {
    document.getElementById('program-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            code: formData.get('code').trim(),
            name: formData.get('name').trim(),
            description: formData.get('description').trim()
        };
        if (!payload.code || !payload.name) {
            alert('Program code and name are required.');
            return;
        }
        try {
            await postJson('/programs', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderProgramTable();
        } catch (error) {
            console.error('Failed to save program', error);
            alert(error.message || 'Failed to save program.');
        }
    });

    document.getElementById('semester-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            name: formData.get('name').trim(),
            sequence: Number(formData.get('sequence'))
        };
        try {
            await postJson('/semesters', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderSemesterTable();
        } catch (error) {
            console.error('Failed to save semester', error);
            alert(error.message || 'Failed to save semester.');
        }
    });

    document.getElementById('course-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            code: formData.get('code').trim(),
            name: formData.get('name').trim(),
            programId: formData.get('programId'),
            semesterId: formData.get('semesterId'),
            credits: Number(formData.get('credits'))
        };
        try {
            await postJson('/courses', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderCourseTable();
        } catch (error) {
            console.error('Failed to save course', error);
            alert(error.message || 'Failed to save course.');
        }
    });

    document.getElementById('student-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            studentId: formData.get('studentId').trim(),
            name: formData.get('name').trim(),
            email: formData.get('email').trim(),
            programId: formData.get('programId')
        };
        if (!payload.studentId || !payload.name || !payload.programId) {
            alert('Student ID, name and program are required.');
            return;
        }
        try {
            await postJson('/students', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderStudentTable();
        } catch (error) {
            console.error('Failed to save student', error);
            alert(error.message || 'Failed to save student.');
        }
    });

    document.getElementById('enrolment-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const enrolmentKey = `${formData.get('studentId')}|${formData.get('courseId')}|${formData.get('semesterId')}|${formData.get('year')}`;
        const alreadyExists = data.enrolments.some(enrol => `${enrol.studentId}|${enrol.courseId}|${enrol.semesterId}|${enrol.year}` === enrolmentKey);
        if (alreadyExists) {
            alert('The student is already enrolled in the selected course and semester.');
            return;
        }
        const payload = {
            studentId: formData.get('studentId'),
            courseId: formData.get('courseId'),
            semesterId: formData.get('semesterId'),
            year: formData.get('year').trim()
        };
        try {
            await postJson('/enrolments', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderEnrolmentTable();
        } catch (error) {
            console.error('Failed to save enrolment', error);
            alert(error.message || 'Failed to save enrolment.');
        }
    });

    document.getElementById('program-outcome-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const programOutcomeKey = `${formData.get('programId')}|${formData.get('code').trim().toUpperCase()}`;
        const alreadyExists = data.programOutcomes.some(outcome => `${outcome.programId}|${outcome.code.toUpperCase()}` === programOutcomeKey);
        if (alreadyExists) {
            alert('A program outcome with the same code already exists for the selected program.');
            return;
        }
        const payload = {
            programId: formData.get('programId'),
            code: formData.get('code').trim(),
            description: formData.get('description').trim()
        };
        try {
            await postJson('/programOutcomes', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderProgramOutcomeTable();
            renderCoPoTable();
        } catch (error) {
            console.error('Failed to save program outcome', error);
            alert(error.message || 'Failed to save program outcome.');
        }
    });

    document.getElementById('course-outcome-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const courseOutcomeKey = `${formData.get('courseId')}|${formData.get('code').trim().toUpperCase()}`;
        const alreadyExists = data.courseOutcomes.some(outcome => `${outcome.courseId}|${outcome.code.toUpperCase()}` === courseOutcomeKey);
        if (alreadyExists) {
            alert('A course outcome with the same code already exists for the selected course.');
            return;
        }
        const payload = {
            courseId: formData.get('courseId'),
            code: formData.get('code').trim(),
            description: formData.get('description').trim()
        };
        try {
            await postJson('/courseOutcomes', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderCourseOutcomeTable();
            renderCoPoTable();
        } catch (error) {
            console.error('Failed to save course outcome', error);
            alert(error.message || 'Failed to save course outcome.');
        }
    });

    document.getElementById('co-po-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const mappingKey = `${formData.get('courseOutcomeId')}|${formData.get('programOutcomeId')}`;
        const alreadyExists = data.coPoMappings.some(mapping => `${mapping.courseOutcomeId}|${mapping.programOutcomeId}` === mappingKey);
        if (alreadyExists) {
            alert('A mapping between the selected CO and PO already exists.');
            return;
        }
        const payload = {
            courseOutcomeId: formData.get('courseOutcomeId'),
            programOutcomeId: formData.get('programOutcomeId'),
            weight: Number(formData.get('weight')) || 0
        };
        try {
            await postJson('/coPoMappings', payload);
            event.target.reset();
            await reloadDataFromServer();
            renderCoPoTable();
        } catch (error) {
            console.error('Failed to save CO-PO mapping', error);
            alert(error.message || 'Failed to save CO-PO mapping.');
        }
    });

    document.getElementById('assessment-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            courseId: formData.get('courseId'),
            name: formData.get('name').trim(),
            type: formData.get('type').trim(),
            maxMarks: Number(formData.get('maxMarks')) || 0,
            semesterId: formData.get('semesterId')
        };
        try {
            await postJson('/assessments', payload);
            event.target.reset();
            await reloadDataFromServer();
            refreshSelectOptions();
            renderAssessmentTable();
        } catch (error) {
            console.error('Failed to save assessment', error);
            alert(error.message || 'Failed to save assessment.');
        }
    });

    document.getElementById('assessment-co-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const mappingKey = `${formData.get('assessmentId')}|${formData.get('courseOutcomeId')}`;
        const alreadyExists = data.assessmentCoMappings.some(mapping => `${mapping.assessmentId}|${mapping.courseOutcomeId}` === mappingKey);
        if (alreadyExists) {
            alert('A mapping between the selected assessment and course outcome already exists.');
            return;
        }
        const payload = {
            assessmentId: formData.get('assessmentId'),
            courseOutcomeId: formData.get('courseOutcomeId'),
            weight: Number(formData.get('weight')) || 0
        };
        try {
            await postJson('/assessmentCoMappings', payload);
            event.target.reset();
            await reloadDataFromServer();
            renderAssessmentCoTable();
        } catch (error) {
            console.error('Failed to save assessment-CO mapping', error);
            alert(error.message || 'Failed to save assessment-CO mapping.');
        }
    });

    const markForm = document.getElementById('mark-form');
    const markCourseSelect = markForm?.querySelector('select[name="courseId"]');
    const markAssessmentSelect = markForm?.querySelector('select[name="assessmentId"]');
    const markEnrolmentSelect = markForm?.querySelector('select[name="enrolmentId"]');

    markCourseSelect?.addEventListener('change', () => {
        updateMarkFormSelectors();
    });

    markForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            enrolmentId: formData.get('enrolmentId'),
            assessmentId: formData.get('assessmentId'),
            marks: Number(formData.get('marks'))
        };
        if (!payload.enrolmentId || !payload.assessmentId || Number.isNaN(payload.marks)) {
            alert('Enrolment, assessment and marks are required.');
            return;
        }
        try {
            await postJson('/marks', payload);
            event.target.reset();
            if (markAssessmentSelect) {
                markAssessmentSelect.value = '';
            }
            if (markEnrolmentSelect) {
                markEnrolmentSelect.value = '';
            }
            await reloadDataFromServer();
            updateMarkFormSelectors();
            renderMarkTable();
            renderMarkView(lastMarkViewCourseId);
            regenerateReportsAfterMarkChange();
        } catch (error) {
            console.error('Failed to save marks', error);
            alert(error.message || 'Failed to save marks.');
        }
    });

    document.getElementById('course-report-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = {
            courseId: formData.get('courseId'),
            semesterId: formData.get('semesterId'),
            year: formData.get('year').trim(),
            summary: formData.get('summary').trim(),
            actions: formData.get('actions').trim()
        };
        try {
            await postJson('/courseReports', payload);
            event.target.reset();
            await reloadDataFromServer();
            renderCourseReportTable();
        } catch (error) {
            console.error('Failed to save course report', error);
            alert(error.message || 'Failed to save course report.');
        }
    });

    document.getElementById('mark-view-filter')?.addEventListener('submit', event => {
        event.preventDefault();
        const courseId = new FormData(event.target).get('courseId') || '';
        lastMarkViewCourseId = courseId;
        renderMarkView(courseId);
    });

    document.getElementById('co-student-filter')?.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        lastCoStudentFilter = {
            studentId: formData.get('studentId'),
            courseId: formData.get('courseId')
        };
        renderCoAchievementForStudent(lastCoStudentFilter.studentId, lastCoStudentFilter.courseId);
    });

    document.getElementById('co-semester-filter')?.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        lastCoSemesterFilter = {
            courseId: formData.get('courseId'),
            semesterId: formData.get('semesterId')
        };
        renderCoAchievementForSemester(lastCoSemesterFilter.courseId, lastCoSemesterFilter.semesterId);
    });

    document.getElementById('po-student-filter')?.addEventListener('submit', event => {
        event.preventDefault();
        const studentId = new FormData(event.target).get('studentId');
        lastPoStudentFilter = { studentId };
        renderPoAchievementForStudent(studentId);
    });

    document.getElementById('po-semester-filter')?.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        lastPoSemesterFilter = {
            programId: formData.get('programId'),
            semesterId: formData.get('semesterId')
        };
        renderPoAchievementForSemester(lastPoSemesterFilter.programId, lastPoSemesterFilter.semesterId);
    });

    document.getElementById('po-co-filter')?.addEventListener('submit', event => {
        event.preventDefault();
        const programId = new FormData(event.target).get('programId');
        lastPoCoProgramId = programId;
        renderPoCoReport(programId);
    });
}

function refreshSelectOptions() {
    const programOptions = data.programs
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(program => ({ value: program.id, label: `${program.code} — ${program.name}` }));

    populateSelect(document.querySelector('#course-form select[name="programId"]'), programOptions);
    populateSelect(document.querySelector('#student-form select[name="programId"]'), programOptions);
    populateSelect(document.querySelector('#program-outcome-form select[name="programId"]'), programOptions);
    populateSelect(document.querySelector('#po-semester-filter select[name="programId"]'), programOptions, { placeholder: 'Select program', allowEmpty: true });
    populateSelect(document.querySelector('#po-co-filter select[name="programId"]'), programOptions, { placeholder: 'Select program', allowEmpty: false });

    const semesterOptions = data.semesters
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map(semester => ({ value: semester.id, label: `${semester.sequence}. ${semester.name}` }));

    document.querySelectorAll('form select[name="semesterId"]').forEach(select => {
        const allowEmpty = select.closest('form').id.includes('filter');
        populateSelect(select, semesterOptions, { placeholder: 'Select semester', allowEmpty });
    });

    const courseOptions = data.courses
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(course => {
            const program = getProgram(course.programId);
            return {
                value: course.id,
                label: `${course.code} — ${course.name}${program ? ` (${program.code})` : ''}`
            };
        });

    populateSelect(document.querySelector('#course-form select[name="courseId"]'), courseOptions);
    populateSelect(document.querySelector('#course-outcome-form select[name="courseId"]'), courseOptions);
    populateSelect(document.querySelector('#assessment-form select[name="courseId"]'), courseOptions);
    populateSelect(document.querySelector('#enrolment-form select[name="courseId"]'), courseOptions);
    populateSelect(document.querySelector('#mark-view-filter select[name="courseId"]'), courseOptions, { placeholder: 'All courses (optional)', allowEmpty: true });
    populateSelect(document.querySelector('#co-student-filter select[name="courseId"]'), courseOptions);
    populateSelect(document.querySelector('#co-semester-filter select[name="courseId"]'), courseOptions);
    populateSelect(document.querySelector('#course-report-form select[name="courseId"]'), courseOptions);

    populateSelect(document.querySelector('#mark-form select[name="courseId"]'), courseOptions);

    const studentOptions = data.students
        .slice()
        .sort((a, b) => a.studentId.localeCompare(b.studentId))
        .map(student => ({ value: student.id, label: `${student.studentId} — ${student.name}` }));

    populateSelect(document.querySelector('#enrolment-form select[name="studentId"]'), studentOptions);
    populateSelect(document.querySelector('#mark-form select[name="enrolmentId"]'), [], { placeholder: 'Select course first', allowEmpty: false });
    populateSelect(document.querySelector('#co-student-filter select[name="studentId"]'), studentOptions);
    populateSelect(document.querySelector('#po-student-filter select[name="studentId"]'), studentOptions);

    const programOutcomeOptions = data.programOutcomes
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(outcome => {
            const program = getProgram(outcome.programId);
            return {
                value: outcome.id,
                label: `${outcome.code} — ${outcome.description}${program ? ` (${program.code})` : ''}`
            };
        });

    populateSelect(document.querySelector('#co-po-form select[name="programOutcomeId"]'), programOutcomeOptions);

    const courseOutcomeOptions = data.courseOutcomes
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(outcome => {
            const course = getCourse(outcome.courseId);
            return {
                value: outcome.id,
                label: `${outcome.code} — ${outcome.description}${course ? ` (${course.code})` : ''}`
            };
        });

    populateSelect(document.querySelector('#co-po-form select[name="courseOutcomeId"]'), courseOutcomeOptions);
    populateSelect(document.querySelector('#assessment-co-form select[name="courseOutcomeId"]'), courseOutcomeOptions);

    const assessmentOptions = data.assessments
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(assessment => {
            const course = getCourse(assessment.courseId);
            return {
                value: assessment.id,
                label: `${assessment.name} — ${assessment.type}${course ? ` (${course.code})` : ''}`
            };
        });

    populateSelect(document.querySelector('#assessment-co-form select[name="assessmentId"]'), assessmentOptions);

    updateMarkFormSelectors();
}

function populateSelect(select, options, { placeholder = 'Select option', allowEmpty = false, autoSelectFirst = true } = {}) {
    if (!select) return;
    const previousValue = select.value;
    select.innerHTML = '';

    if (placeholder) {
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = placeholder;
        placeholderOption.selected = true;
        if (!allowEmpty) {
            placeholderOption.disabled = true;
        }
        select.appendChild(placeholderOption);
    }

    options.forEach(option => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        select.appendChild(element);
    });

    if (options.some(option => option.value === previousValue)) {
        select.value = previousValue;
    } else if (!allowEmpty && options.length > 0 && autoSelectFirst) {
        select.selectedIndex = 1; // First non-placeholder option
    } else {
        select.value = '';
    }

    select.disabled = !allowEmpty && options.length === 0;
}

function updateMarkFormSelectors() {
    const markForm = document.getElementById('mark-form');
    if (!markForm) return;

    const courseId = markForm.querySelector('select[name="courseId"]').value;
    const assessmentSelect = markForm.querySelector('select[name="assessmentId"]');
    const enrolmentSelect = markForm.querySelector('select[name="enrolmentId"]');

    const assessments = courseId
        ? data.assessments
            .filter(assessment => assessment.courseId === courseId)
            .map(assessment => ({
                value: assessment.id,
                label: `${assessment.name} — ${assessment.type} (Max ${assessment.maxMarks})`
            }))
        : [];

    populateSelect(assessmentSelect, assessments, {
        placeholder: courseId ? 'Select assessment' : 'Select course first',
        allowEmpty: false,
        autoSelectFirst: false
    });

    const enrolments = courseId
        ? data.enrolments
            .filter(enrolment => enrolment.courseId === courseId)
            .map(enrolment => {
                const student = getStudent(enrolment.studentId);
                const semester = getSemester(enrolment.semesterId);
                return {
                    value: enrolment.id,
                    label: `${student ? student.name : 'Unknown'} — ${semester ? semester.name : 'Semester'} ${enrolment.year}`
                };
            })
        : [];

    populateSelect(enrolmentSelect, enrolments, {
        placeholder: courseId ? 'Select student enrolment' : 'Select course first',
        allowEmpty: false,
        autoSelectFirst: false
    });
}

function renderAllTables() {
    renderProgramTable();
    renderSemesterTable();
    renderCourseTable();
    renderStudentTable();
    renderEnrolmentTable();
    renderProgramOutcomeTable();
    renderCourseOutcomeTable();
    renderCoPoTable();
    renderAssessmentTable();
    renderAssessmentCoTable();
    renderMarkTable();
    renderCourseReportTable();
}

function renderProgramTable() {
    const table = document.getElementById('program-table');
    if (!table) return;
    if (data.programs.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No programs recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.programs
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(program => `<tr><td>${program.code}</td><td>${program.name}</td><td>${program.description || '—'}</td></tr>`)
        .join('');
    table.innerHTML = `<thead><tr><th>Code</th><th>Name</th><th>Description</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderSemesterTable() {
    const table = document.getElementById('semester-table');
    if (!table) return;
    if (data.semesters.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No semesters recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.semesters
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map(semester => `<tr><td>${semester.sequence}</td><td>${semester.name}</td></tr>`)
        .join('');
    table.innerHTML = `<thead><tr><th>Sequence</th><th>Name</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderCourseTable() {
    const table = document.getElementById('course-table');
    if (!table) return;
    if (data.courses.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No courses recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.courses
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(course => {
            const program = getProgram(course.programId);
            const semester = getSemester(course.semesterId);
            return `<tr><td>${course.code}</td><td>${course.name}</td><td>${program ? program.code : '—'}</td><td>${semester ? semester.name : '—'}</td><td>${course.credits}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Code</th><th>Name</th><th>Program</th><th>Semester</th><th>Credits</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderStudentTable() {
    const table = document.getElementById('student-table');
    if (!table) return;
    if (data.students.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No students recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.students
        .slice()
        .sort((a, b) => a.studentId.localeCompare(b.studentId))
        .map(student => {
            const program = getProgram(student.programId);
            return `<tr><td>${student.studentId}</td><td>${student.name}</td><td>${student.email || '—'}</td><td>${program ? program.code : '—'}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Program</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderEnrolmentTable() {
    const table = document.getElementById('enrolment-table');
    if (!table) return;
    if (data.enrolments.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No enrolments recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.enrolments
        .slice()
        .map(enrolment => {
            const student = getStudent(enrolment.studentId);
            const course = getCourse(enrolment.courseId);
            const semester = getSemester(enrolment.semesterId);
            return `<tr><td>${student ? student.studentId : '—'}</td><td>${student ? student.name : '—'}</td><td>${course ? course.code : '—'}</td><td>${semester ? semester.name : '—'}</td><td>${enrolment.year}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Student ID</th><th>Student Name</th><th>Course</th><th>Semester</th><th>Academic Year</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderProgramOutcomeTable() {
    const table = document.getElementById('program-outcome-table');
    if (!table) return;
    if (data.programOutcomes.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No program outcomes recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.programOutcomes
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(outcome => {
            const program = getProgram(outcome.programId);
            return `<tr><td>${outcome.code}</td><td>${program ? program.code : '—'}</td><td>${outcome.description}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Outcome Code</th><th>Program</th><th>Description</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderCourseOutcomeTable() {
    const table = document.getElementById('course-outcome-table');
    if (!table) return;
    if (data.courseOutcomes.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No course outcomes recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.courseOutcomes
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(outcome => {
            const course = getCourse(outcome.courseId);
            return `<tr><td>${outcome.code}</td><td>${course ? course.code : '—'}</td><td>${outcome.description}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Outcome Code</th><th>Course</th><th>Description</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderCoPoTable() {
    const table = document.getElementById('co-po-table');
    if (!table) return;
    if (data.coPoMappings.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No CO-PO mappings recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.coPoMappings
        .slice()
        .map(mapping => {
            const courseOutcome = getCourseOutcome(mapping.courseOutcomeId);
            const programOutcome = getProgramOutcome(mapping.programOutcomeId);
            const course = courseOutcome ? getCourse(courseOutcome.courseId) : null;
            return `<tr><td>${courseOutcome ? courseOutcome.code : '—'}</td><td>${course ? course.code : '—'}</td><td>${programOutcome ? programOutcome.code : '—'}</td><td>${mapping.weight}%</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Course Outcome</th><th>Course</th><th>Program Outcome</th><th>Weight</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderAssessmentTable() {
    const table = document.getElementById('assessment-table');
    if (!table) return;
    if (data.assessments.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No assessments recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.assessments
        .slice()
        .map(assessment => {
            const course = getCourse(assessment.courseId);
            const semester = getSemester(assessment.semesterId);
            return `<tr><td>${assessment.name}</td><td>${assessment.type}</td><td>${course ? course.code : '—'}</td><td>${semester ? semester.name : '—'}</td><td>${assessment.maxMarks}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Name</th><th>Type</th><th>Course</th><th>Semester</th><th>Max Marks</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderAssessmentCoTable() {
    const table = document.getElementById('assessment-co-table');
    if (!table) return;
    if (data.assessmentCoMappings.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No assessment to CO mappings recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.assessmentCoMappings
        .slice()
        .map(mapping => {
            const assessment = getAssessment(mapping.assessmentId);
            const courseOutcome = getCourseOutcome(mapping.courseOutcomeId);
            const course = assessment ? getCourse(assessment.courseId) : null;
            return `<tr><td>${assessment ? assessment.name : '—'}</td><td>${course ? course.code : '—'}</td><td>${courseOutcome ? courseOutcome.code : '—'}</td><td>${mapping.weight}%</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Assessment</th><th>Course</th><th>Course Outcome</th><th>Contribution</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderMarkTable() {
    const table = document.getElementById('mark-table');
    if (!table) return;
    if (data.marks.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No marks uploaded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.marks
        .slice()
        .map(entry => {
            const enrolment = getEnrolment(entry.enrolmentId);
            const student = enrolment ? getStudent(enrolment.studentId) : null;
            const course = enrolment ? getCourse(enrolment.courseId) : null;
            const assessment = getAssessment(entry.assessmentId);
            return `<tr><td>${student ? student.studentId : '—'}</td><td>${student ? student.name : '—'}</td><td>${course ? course.code : '—'}</td><td>${assessment ? assessment.name : '—'}</td><td>${entry.marks}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Student ID</th><th>Name</th><th>Course</th><th>Assessment</th><th>Marks</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderCourseReportTable() {
    const table = document.getElementById('course-report-table');
    if (!table) return;
    if (data.courseReports.length === 0) {
        table.innerHTML = '<tbody><tr><td class="empty-state">No course reports recorded yet.</td></tr></tbody>';
        return;
    }
    const rows = data.courseReports
        .slice()
        .map(report => {
            const course = getCourse(report.courseId);
            const semester = getSemester(report.semesterId);
            return `<tr><td>${course ? course.code : '—'}</td><td>${semester ? semester.name : '—'}</td><td>${report.year}</td><td>${report.summary}</td><td>${report.actions}</td></tr>`;
        })
        .join('');
    table.innerHTML = `<thead><tr><th>Course</th><th>Semester</th><th>Academic Year</th><th>Summary</th><th>Improvement Actions</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderMarkView(courseId) {
    const container = document.getElementById('mark-view-content');
    if (!container) return;
    if (!courseId) {
        container.innerHTML = '<p class="empty-state">Select a course to view uploaded marks.</p>';
        return;
    }
    const course = getCourse(courseId);
    const assessments = data.assessments.filter(assessment => assessment.courseId === courseId);
    if (assessments.length === 0) {
        container.innerHTML = '<p class="empty-state">No assessments configured for the selected course.</p>';
        return;
    }
    const enrolments = data.enrolments.filter(enrolment => enrolment.courseId === courseId);
    if (enrolments.length === 0) {
        container.innerHTML = '<p class="empty-state">No student enrolments found for the selected course.</p>';
        return;
    }
    const headers = assessments.map(assessment => `<th>${assessment.name}<br><span class="muted">Max ${assessment.maxMarks}</span></th>`).join('');
    const rows = enrolments.map(enrolment => {
        const student = getStudent(enrolment.studentId);
        const cells = assessments.map(assessment => {
            const mark = data.marks.find(entry => entry.enrolmentId === enrolment.id && entry.assessmentId === assessment.id);
            return `<td>${mark ? mark.marks : '—'}</td>`;
        }).join('');
        return `<tr><td>${student ? student.studentId : '—'}<br>${student ? student.name : ''}</td>${cells}</tr>`;
    }).join('');
    container.innerHTML = `<table class="report-table"><thead><tr><th>Student</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCoAchievementForStudent(studentId, courseId) {
    const container = document.getElementById('co-student-report');
    if (!container) return;
    if (!studentId || !courseId) {
        container.innerHTML = '<p class="empty-state">Select a student and course to view attainment.</p>';
        return;
    }
    const enrolment = findLatestEnrolment(studentId, courseId);
    if (!enrolment) {
        container.innerHTML = '<p class="empty-state">No enrolment found for the selected student and course.</p>';
        return;
    }
    const courseOutcomes = data.courseOutcomes.filter(outcome => outcome.courseId === courseId);
    if (courseOutcomes.length === 0) {
        container.innerHTML = '<p class="empty-state">No course outcomes configured for the selected course.</p>';
        return;
    }
    const rows = courseOutcomes.map(outcome => {
        const attainment = calculateCourseOutcomeAchievement(enrolment, outcome.id);
        if (attainment === null) {
            return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>—</td><td>No assessment mapping</td></tr>`;
        }
        const status = attainment >= 60 ? 'Achieved' : 'Needs Attention';
        return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>${formatPercentage(attainment)}</td><td>${status}</td></tr>`;
    }).join('');
    container.innerHTML = `<table class="report-table"><thead><tr><th>Course Outcome</th><th>Description</th><th>Achievement</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCoAchievementForSemester(courseId, semesterId) {
    const container = document.getElementById('co-semester-report');
    if (!container) return;
    if (!courseId || !semesterId) {
        container.innerHTML = '<p class="empty-state">Select a course and semester to view attainment.</p>';
        return;
    }
    const enrolments = data.enrolments.filter(enrolment => enrolment.courseId === courseId && enrolment.semesterId === semesterId);
    if (enrolments.length === 0) {
        container.innerHTML = '<p class="empty-state">No enrolments found for the selected course and semester.</p>';
        return;
    }
    const courseOutcomes = data.courseOutcomes.filter(outcome => outcome.courseId === courseId);
    if (courseOutcomes.length === 0) {
        container.innerHTML = '<p class="empty-state">No course outcomes configured for the selected course.</p>';
        return;
    }
    const rows = courseOutcomes.map(outcome => {
        const attainments = enrolments
            .map(enrolment => calculateCourseOutcomeAchievement(enrolment, outcome.id))
            .filter(value => value !== null);
        if (attainments.length === 0) {
            return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>—</td><td>No marks uploaded</td></tr>`;
        }
        const average = attainments.reduce((sum, value) => sum + value, 0) / attainments.length;
        const status = average >= 60 ? 'Achieved' : 'Needs Attention';
        return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>${formatPercentage(average)}</td><td>${status}</td></tr>`;
    }).join('');
    container.innerHTML = `<table class="report-table"><thead><tr><th>Course Outcome</th><th>Description</th><th>Average Achievement</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPoAchievementForStudent(studentId) {
    const container = document.getElementById('po-student-report');
    if (!container) return;
    if (!studentId) {
        container.innerHTML = '<p class="empty-state">Select a student to generate the report.</p>';
        return;
    }
    const student = getStudent(studentId);
    if (!student) {
        container.innerHTML = '<p class="empty-state">Student not found.</p>';
        return;
    }
    const programOutcomes = data.programOutcomes.filter(outcome => outcome.programId === student.programId);
    if (programOutcomes.length === 0) {
        container.innerHTML = '<p class="empty-state">No program outcomes configured for the student\'s program.</p>';
        return;
    }
    const results = programOutcomes.map(outcome => {
        const attainment = calculateProgramOutcomeAchievementForStudent(studentId, outcome.id);
        return { outcome, attainment };
    });
    const rows = results.map(({ outcome, attainment }) => {
        if (attainment === null) {
            return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>—</td><td>No contributing CO attainment</td></tr>`;
        }
        const status = attainment >= 60 ? 'Achieved' : 'Needs Attention';
        return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>${formatPercentage(attainment)}</td><td>${status}</td></tr>`;
    }).join('');
    container.innerHTML = `<table class="report-table"><thead><tr><th>Program Outcome</th><th>Description</th><th>Achievement</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPoAchievementForSemester(programId, semesterId) {
    const container = document.getElementById('po-semester-report');
    if (!container) return;
    if (!programId || !semesterId) {
        container.innerHTML = '<p class="empty-state">Select a program and semester to generate the report.</p>';
        return;
    }
    const programOutcomes = data.programOutcomes.filter(outcome => outcome.programId === programId);
    if (programOutcomes.length === 0) {
        container.innerHTML = '<p class="empty-state">No program outcomes configured for the selected program.</p>';
        return;
    }
    const students = data.students.filter(student => student.programId === programId);
    const rows = programOutcomes.map(outcome => {
        const attainments = students
            .map(student => calculateProgramOutcomeAchievementForStudent(student.id, outcome.id, { semesterId }))
            .filter(value => value !== null);
        if (attainments.length === 0) {
            return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>—</td><td>No contributing data</td></tr>`;
        }
        const average = attainments.reduce((sum, value) => sum + value, 0) / attainments.length;
        const status = average >= 60 ? 'Achieved' : 'Needs Attention';
        return `<tr><td>${outcome.code}</td><td>${outcome.description}</td><td>${formatPercentage(average)}</td><td>${status}</td></tr>`;
    }).join('');
    container.innerHTML = `<table class="report-table"><thead><tr><th>Program Outcome</th><th>Description</th><th>Average Achievement</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPoCoReport(programId) {
    const container = document.getElementById('po-co-content');
    if (!container) return;
    if (!programId) {
        container.innerHTML = '<p class="empty-state">Select a program to generate the mapping report.</p>';
        return;
    }
    const program = getProgram(programId);
    if (!program) {
        container.innerHTML = '<p class="empty-state">Program not found.</p>';
        return;
    }
    const programOutcomes = data.programOutcomes.filter(outcome => outcome.programId === programId);
    const courses = data.courses.filter(course => course.programId === programId);
    const courseIds = new Set(courses.map(course => course.id));
    const courseOutcomes = data.courseOutcomes.filter(outcome => courseIds.has(outcome.courseId));
    if (programOutcomes.length === 0 || courseOutcomes.length === 0) {
        container.innerHTML = '<p class="empty-state">Add course outcomes and program outcomes to view the mapping.</p>';
        return;
    }
    const mappingMap = new Map();
    data.coPoMappings.forEach(mapping => {
        const key = `${mapping.courseOutcomeId}|${mapping.programOutcomeId}`;
        mappingMap.set(key, mapping.weight);
    });
    const headerRow = programOutcomes.map(outcome => `<th>${outcome.code}</th>`).join('');
    const rows = courseOutcomes.map(outcome => {
        const cells = programOutcomes.map(po => {
            const weight = mappingMap.get(`${outcome.id}|${po.id}`);
            return `<td>${weight !== undefined ? weight + '%' : '—'}</td>`;
        }).join('');
        const course = getCourse(outcome.courseId);
        return `<tr><td>${outcome.code}${course ? `<br><span class="muted">${course.code}</span>` : ''}</td>${cells}</tr>`;
    }).join('');
    container.innerHTML = `<h3>${program.name}</h3><table class="report-table"><thead><tr><th>Course Outcomes</th>${headerRow}</tr></thead><tbody>${rows}</tbody></table>`;
}

function calculateCourseOutcomeAchievement(enrolment, courseOutcomeId) {
    const relevantMappings = data.assessmentCoMappings.filter(mapping => mapping.courseOutcomeId === courseOutcomeId);
    if (relevantMappings.length === 0) {
        return null;
    }
    let totalWeightedMax = 0;
    let totalWeightedScore = 0;
    relevantMappings.forEach(mapping => {
        const assessment = getAssessment(mapping.assessmentId);
        if (!assessment || assessment.courseId !== enrolment.courseId) {
            return;
        }
        const weight = mapping.weight && mapping.weight > 0 ? mapping.weight / 100 : 1;
        const markEntry = data.marks.find(entry => entry.enrolmentId === enrolment.id && entry.assessmentId === assessment.id);
        totalWeightedMax += assessment.maxMarks * weight;
        totalWeightedScore += (markEntry ? markEntry.marks : 0) * weight;
    });
    if (totalWeightedMax === 0) {
        return null;
    }
    return (totalWeightedScore / totalWeightedMax) * 100;
}

function calculateProgramOutcomeAchievementForStudent(studentId, programOutcomeId, { semesterId = null } = {}) {
    const programOutcome = getProgramOutcome(programOutcomeId);
    if (!programOutcome) {
        return null;
    }
    const enrolments = data.enrolments.filter(enrolment => enrolment.studentId === studentId && (!semesterId || enrolment.semesterId === semesterId));
    if (enrolments.length === 0) {
        return null;
    }
    const relevantMappings = data.coPoMappings.filter(mapping => mapping.programOutcomeId === programOutcomeId);
    if (relevantMappings.length === 0) {
        return null;
    }
    let totalWeight = 0;
    let weightedSum = 0;
    relevantMappings.forEach(mapping => {
        const courseOutcome = getCourseOutcome(mapping.courseOutcomeId);
        if (!courseOutcome) return;
        const enrolmentsForCourse = enrolments.filter(enrolment => enrolment.courseId === courseOutcome.courseId);
        if (enrolmentsForCourse.length === 0) return;
        const attainments = enrolmentsForCourse
            .map(enrolment => calculateCourseOutcomeAchievement(enrolment, courseOutcome.id))
            .filter(value => value !== null);
        if (attainments.length === 0) return;
        const average = attainments.reduce((sum, value) => sum + value, 0) / attainments.length;
        const weight = mapping.weight && mapping.weight > 0 ? mapping.weight : 100;
        totalWeight += weight;
        weightedSum += average * weight;
    });
    if (totalWeight === 0) {
        return null;
    }
    return weightedSum / totalWeight;
}

function regenerateReportsAfterMarkChange() {
    if (lastCoStudentFilter) {
        renderCoAchievementForStudent(lastCoStudentFilter.studentId, lastCoStudentFilter.courseId);
    }
    if (lastCoSemesterFilter) {
        renderCoAchievementForSemester(lastCoSemesterFilter.courseId, lastCoSemesterFilter.semesterId);
    }
    if (lastPoStudentFilter) {
        renderPoAchievementForStudent(lastPoStudentFilter.studentId);
    }
    if (lastPoSemesterFilter) {
        renderPoAchievementForSemester(lastPoSemesterFilter.programId, lastPoSemesterFilter.semesterId);
    }
    if (lastPoCoProgramId) {
        renderPoCoReport(lastPoCoProgramId);
    }
}

function findLatestEnrolment(studentId, courseId) {
    const enrolments = data.enrolments.filter(enrolment => enrolment.studentId === studentId && enrolment.courseId === courseId);
    if (enrolments.length === 0) {
        return null;
    }
    return enrolments[enrolments.length - 1];
}

function formatPercentage(value) {
    return `${value.toFixed(2)}%`;
}

function getProgram(id) {
    return data.programs.find(program => program.id === id) || null;
}

function getSemester(id) {
    return data.semesters.find(semester => semester.id === id) || null;
}

function getCourse(id) {
    return data.courses.find(course => course.id === id) || null;
}

function getStudent(id) {
    return data.students.find(student => student.id === id) || null;
}

function getEnrolment(id) {
    return data.enrolments.find(enrolment => enrolment.id === id) || null;
}

function getProgramOutcome(id) {
    return data.programOutcomes.find(outcome => outcome.id === id) || null;
}

function getCourseOutcome(id) {
    return data.courseOutcomes.find(outcome => outcome.id === id) || null;
}

function getAssessment(id) {
    return data.assessments.find(assessment => assessment.id === id) || null;
}
