#!/usr/bin/env bash
# Verify instructor unlock -> employee access
# Usage: edit the variables below or export them before running

set -euo pipefail

BASE=${BASE:-http://127.0.0.1:8000}
INSTRUCTOR_EMAIL=""
INSTRUCTOR_PASSWORD=""
EMPLOYEE_EMAIL=""
EMPLOYEE_PASSWORD=""
COURSE_ID=""

if ! command -v jq >/dev/null 2>&1; then
  echo "This script requires 'jq' (https://stedolan.github.io/jq/)." >&2
  exit 1
fi

if [ -z "$INSTRUCTOR_EMAIL" ] || [ -z "$INSTRUCTOR_PASSWORD" ] || [ -z "$EMPLOYEE_EMAIL" ] || [ -z "$EMPLOYEE_PASSWORD" ] || [ -z "$COURSE_ID" ]; then
  echo "Please set the variables at the top of this script or export them in your environment:" >&2
  echo "  INSTRUCTOR_EMAIL, INSTRUCTOR_PASSWORD, EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD, COURSE_ID" >&2
  echo "Or run like: INSTRUCTOR_EMAIL=... INSTRUCTOR_PASSWORD=... COURSE_ID=... ./scripts/verify_unlock.sh" >&2
  exit 2
fi

echo "Logging in as instructor ($INSTRUCTOR_EMAIL)..."
INST_RESP=$(curl -s -X POST "$BASE/api/login" -H "Accept: application/json" -d "email=${INSTRUCTOR_EMAIL}&password=${INSTRUCTOR_PASSWORD}")
INST_TOKEN=$(echo "$INST_RESP" | jq -r '.token // empty')
if [ -z "$INST_TOKEN" ]; then
  echo "Instructor login failed: $INST_RESP" >&2
  exit 3
fi

echo "Fetching enrolled users for course $COURSE_ID..."
ENROLLED_JSON=$(curl -s -X GET "$BASE/api/instructor/courses/$COURSE_ID" -H "Accept: application/json" -H "Authorization: Bearer $INST_TOKEN")
echo "$ENROLLED_JSON" | jq '.enrolledUsers'

ENROLLED_IDS=$(echo "$ENROLLED_JSON" | jq -r '.enrolledUsers[]?.id') || true

if [ -z "$ENROLLED_IDS" ]; then
  echo "No enrolled users found (or none listed).";
else
  echo "Unlocking enrolled users..."
  while read -r uid; do
    if [ -z "$uid" ]; then continue; fi
    echo "Unlocking user $uid..."
    curl -s -X POST "$BASE/api/instructor/courses/$COURSE_ID/enrollments/${uid}/unlock" \
      -H "Accept: application/json" -H "Authorization: Bearer $INST_TOKEN" >/dev/null || true
  done <<< "$ENROLLED_IDS"
fi

echo "Confirming enrollments after unlock:"
curl -s -X GET "$BASE/api/instructor/courses/$COURSE_ID" -H "Accept: application/json" -H "Authorization: Bearer $INST_TOKEN" | jq '.enrolledUsers'

echo "Logging in as employee ($EMPLOYEE_EMAIL)..."
EMP_RESP=$(curl -s -X POST "$BASE/api/login" -H "Accept: application/json" -d "email=${EMPLOYEE_EMAIL}&password=${EMPLOYEE_PASSWORD}")
EMP_TOKEN=$(echo "$EMP_RESP" | jq -r '.token // empty')
if [ -z "$EMP_TOKEN" ]; then
  echo "Employee login failed: $EMP_RESP" >&2
  exit 4
fi

echo "Employee trying to access course $COURSE_ID..."
EMP_ACCESS=$(curl -s -o /dev/stderr -w "%{http_code}" -X GET "$BASE/api/employee/courses/$COURSE_ID" -H "Accept: application/json" -H "Authorization: Bearer $EMP_TOKEN")
echo "Employee request returned HTTP $EMP_ACCESS"

if [ "$EMP_ACCESS" -eq 200 ]; then
  echo "Course accessible to employee (unlocked)."
else
  echo "Employee could not access course; HTTP $EMP_ACCESS. Check response above for details."
fi
