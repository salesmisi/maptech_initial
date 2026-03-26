#!/usr/bin/env node
// Node verification script: instructor unlock -> employee verify
// Usage: set env vars or pass args. Requires Node 18+ for global fetch.

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const INSTRUCTOR_EMAIL = process.env.INSTRUCTOR_EMAIL || '';
const INSTRUCTOR_PASSWORD = process.env.INSTRUCTOR_PASSWORD || '';
const EMPLOYEE_EMAIL = process.env.EMPLOYEE_EMAIL || '';
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || '';
const COURSE_ID = process.env.COURSE_ID || '';

if (!INSTRUCTOR_EMAIL || !INSTRUCTOR_PASSWORD || !EMPLOYEE_EMAIL || !EMPLOYEE_PASSWORD || !COURSE_ID) {
  console.error('Please set INSTRUCTOR_EMAIL, INSTRUCTOR_PASSWORD, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD, COURSE_ID env vars');
  process.exit(2);
}

async function jsonFetch(url, opts={}){
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return {status: res.status, body: JSON.parse(text)} } catch(e){ return {status: res.status, body: text} }
}

async function login(email, password){
  const res = await jsonFetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: {'Accept':'application/json', 'Content-Type':'application/x-www-form-urlencoded'},
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  });
  return res;
}

async function main(){
  console.log('Logging in as instructor...', INSTRUCTOR_EMAIL);
  const instr = await login(INSTRUCTOR_EMAIL, INSTRUCTOR_PASSWORD);
  if (instr.status !== 200 || !instr.body.token) {
    console.error('Instructor login failed', instr);
    process.exit(3);
  }
  const itoken = instr.body.token;

  console.log('Fetching course enrollments...');
  const course = await jsonFetch(`${BASE}/api/instructor/courses/${COURSE_ID}`, { headers:{ 'Accept':'application/json', 'Authorization': `Bearer ${itoken}` } });
  console.log('Course enrolledUsers:', course.body.enrolledUsers || []);

  const users = course.body.enrolledUsers || [];
  for (const u of users){
    console.log('Unlocking', u.id);
    await jsonFetch(`${BASE}/api/instructor/courses/${COURSE_ID}/enrollments/${u.id}/unlock`, { method:'POST', headers:{ 'Accept':'application/json', 'Authorization': `Bearer ${itoken}` } });
  }

  console.log('Confirming enrollments:');
  const after = await jsonFetch(`${BASE}/api/instructor/courses/${COURSE_ID}`, { headers:{ 'Accept':'application/json', 'Authorization': `Bearer ${itoken}` } });
  console.log(after.body.enrolledUsers);

  console.log('Logging in as employee...', EMPLOYEE_EMAIL);
  const emp = await login(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
  if (emp.status !== 200 || !emp.body.token) {
    console.error('Employee login failed', emp);
    process.exit(4);
  }

  const etoken = emp.body.token;
  const access = await fetch(`${BASE}/api/employee/courses/${COURSE_ID}`, { headers:{ 'Accept':'application/json', 'Authorization': `Bearer ${etoken}` } });
  console.log('Employee course access status:', access.status);
  const text = await access.text();
  console.log(text);
}

main().catch(e=>{ console.error(e); process.exit(1); });
