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

        // Filter out rows where every cell is empty/whitespace
        const validRows = jsonData.filter(row =>
          Object.values(row).some(v => String(v).trim() !== '')
        );

        if (validRows.length === 0) {
          reject(new Error(`File "${file.name}" has headers but no valid data rows.`));
          return;
        }

        // Normalize headers by stripping BOM and trimming whitespace
        const rawHeaders = Object.keys(jsonData[0]);
        const headers = rawHeaders.map(h => h.replace(/^\uFEFF/, '').trim());

        // Re-key rows if headers were normalized
        const normalizedRows = validRows.map(row => {
          const newRow = {};
          rawHeaders.forEach((raw, i) => {
            newRow[headers[i]] = row[raw];
          });
          return newRow;
        });

        resolve({ headers, rows: normalizedRows });
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
  // Priority-ordered regex patterns — first match wins
  const namePatterns = [
    /^student[\s_-]*name$/i,
    /^full[\s_-]*name$/i,
    /^participant[\s_-]*name$/i,
    /^candidate[\s_-]*name$/i,
    /^name$/i,
    /name/i,  // broad fallback: any column containing "name"
  ];

  for (const pattern of namePatterns) {
    const match = headers.find(h => pattern.test(h.trim()));
    if (match) return match;
  }
  return headers[0]; // ultimate fallback to first column
}

/**
 * Auto-detect the "URN" column from headers.
 */
export function detectUrnColumn(headers) {
  // Priority-ordered regex patterns — first match wins
  const urnPatterns = [
    /^urn$/i,
    /^roll[\s_-]*no\.?$/i,
    /^roll$/i,
    /^reg(istration)?[\s_-]*(no\.?|number)?$/i,
    /^enrollment[\s_-]*(no\.?|number)?$/i,
    /^enroll(ment)?$/i,
    /^student[\s_-]*id$/i,
    /^admission[\s_-]*(no\.?|number)?$/i,
    /^id$/i,
    /^prn$/i,
    /^seat[\s_-]*(no\.?|number)?$/i,
    /\burn\b/i,   // broad fallback: any column containing "urn"
    /\broll\b/i,  // broad fallback: any column containing "roll"
  ];

  for (const pattern of urnPatterns) {
    const match = headers.find(h => pattern.test(h.trim()));
    if (match) return match;
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
