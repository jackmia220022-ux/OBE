# Outcome Based Education (OBE) Management Portal

This repository contains a lightweight single-page web application for planning and tracking Outcome Based Education (OBE) workflows. A companion Node.js/Express backend exposes REST endpoints and persists information to a JSON data store, providing a simple self-hosted deployment path.

## Features

The portal covers the typical artefacts required to manage OBE processes:

- **Basic setups** – capture programs and semesters.
- **Course entry** – register courses with program, semester and credit information.
- **Student entry** – maintain basic student records and the program they belong to.
- **Enrolment entry** – enrol students into courses for a given semester and academic year.
- **Program outcome setup** – define POs for each academic program.
- **Course outcome setup** – define COs for each course.
- **CO–PO mapping** – align course outcomes with program outcomes and assign contribution weights.
- **Assessment setup** – create assessment components for courses.
- **Assessment–CO mapping** – connect assessments with the course outcomes they measure.
- **Mark uploading** – record assessment marks per student enrolment.
- **Mark view** – view marks per assessment for all students in a course.
- **CO achievement reports** – generate course outcome attainment for an individual student or aggregated by semester.
- **PO achievement reports** – generate program outcome attainment for individual students or aggregated by semester.
- **PO–CO mapping report** – visualise the alignment matrix for a program.
- **Course CQI reports** – capture continuous quality improvement summaries and actions per course.

## Getting started

1. Clone or download the repository.
2. Install dependencies: `npm install`.
3. Start the backend (which also serves the frontend assets): `npm start`.
4. Navigate to [http://localhost:3000](http://localhost:3000) in a modern browser (Chrome, Edge, Firefox or Safari).

All application data is stored in `data.json` on the server. Stop the server before editing the file manually.

## Technology stack

- Plain HTML, CSS and JavaScript (no client-side frameworks required).
- Tailored styling with CSS, including responsive layouts for smaller screens.
- Node.js with Express for the API and static asset hosting.
- File-based JSON persistence (`data.json`).

## Development notes

- The application is intentionally framework-free on the client to allow quick prototyping in constrained environments, while the backend is kept minimal for ease of hosting.
- Frontend logic lives in `app.js`. API routes are implemented in `server.js`, which writes to `data.json` for persistence.
- Styles are defined in `styles.css` and follow a modern dashboard aesthetic.

## Disclaimer

This project focuses on core data capture and reporting flows for OBE management. It does not include authentication, role management, or integrations with institutional systems. Always evaluate data governance needs before using with real student information.
