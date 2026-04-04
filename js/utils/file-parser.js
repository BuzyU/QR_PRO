import * as XLSX from 'xlsx';

/**
 * Parse an uploaded file (CSV, XLSX, XLS) and return structured data.
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: object[] }>}
 */
export async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (jsonData.length === 0) {
          reject(new Error(`File "${file.name}" is empty or has no data rows.`));
          return;
        }

        const headers = Object.keys(jsonData[0]);
        resolve({ headers, rows: jsonData });
      } catch (err) {
        reject(new Error(`Failed to parse "${file.name}": ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Auto-detect the "name" column from headers.
 */
export function detectNameColumn(headers) {
  const namePatterns = ['name', 'student name', 'student_name', 'studentname', 'full name', 'fullname'];
  for (const h of headers) {
    if (namePatterns.includes(h.toLowerCase().trim())) return h;
  }
  return headers[0]; // fallback to first column
}

/**
 * Auto-detect the "URN" column from headers.
 */
export function detectUrnColumn(headers) {
  const urnPatterns = ['urn', 'roll', 'roll no', 'roll_no', 'rollno', 'registration', 'reg no', 'reg_no', 'id', 'student id'];
  for (const h of headers) {
    if (urnPatterns.includes(h.toLowerCase().trim())) return h;
  }
  return null; // no URN column found
}

/**
 * Parse multiple files and merge all student data.
 * @param {File[]} files
 * @param {string} nameCol - which header to use as name
 * @param {string|null} urnCol - which header to use as URN
 * @returns {Promise<{ name: string, urn: string }[]>}
 */
export async function parseAndMergeFiles(files, nameCol, urnCol) {
  const allStudents = [];

  // Defensive sort: guarantee alphabetical order even if caller didn't sort
  const sortedFiles = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  for (const file of sortedFiles) {
    const { rows } = await parseFile(file);
    for (const row of rows) {
      const name = String(row[nameCol] || '').trim();
      const urn = urnCol ? String(row[urnCol] || '').trim() : '';
      if (name) {
        allStudents.push({ name, urn, sourceFile: file.name });
      }
    }
  }

  return allStudents;
}
