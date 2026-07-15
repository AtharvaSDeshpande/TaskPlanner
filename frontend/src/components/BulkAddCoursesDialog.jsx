import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useBulkCreateCourses } from '../queries/hooks.js';

// Friendly header row of the template — matches the columns of a typical term
// course plan so admins can paste straight from it.
const COLUMNS = [
  'Sub Code',
  'Course Name',
  'Credit',
  'Hrs',
  'SEC',
  'Program',
  'Proposed Faculty',
  'Junior Faculty',
];

// SheetJS is loaded on demand so it never bloats the main bundle.
const loadXLSX = () => import('xlsx');

// Normalises a raw sheet row: lowercases/strips header keys and maps aliases, so
// the import is resilient to header casing/spacing and to either the friendly
// headers above or the API field names.
function normalizeRow(raw) {
  const o = {};
  for (const k of Object.keys(raw)) o[String(k).trim().toLowerCase().replace(/[\s.]+/g, '')] = raw[k];
  return {
    code: o.subcode ?? o.code ?? o.coursecode ?? '',
    title: o.coursename ?? o.title ?? o.name ?? o.course ?? '',
    credits: o.credit ?? o.credits ?? '',
    hours: o.hrs ?? o.hours ?? o.hour ?? '',
    sections: o.sec ?? o.sections ?? o.section ?? o.noofsections ?? '',
    program: o.program ?? '',
    proposedFaculty: o.proposedfaculty ?? o.faculty ?? '',
    juniorFaculty: o.juniorfaculty ?? '',
  };
}

const dash = <em>—</em>;

export default function BulkAddCoursesDialog({ open, onClose }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const bulk = useBulkCreateCourses();
  const result = bulk.data;

  const reset = () => {
    setRows([]);
    setFileName('');
    setError('');
    bulk.reset();
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const sample = [
      {
        'Sub Code': 'POPS109',
        'Course Name': 'ERP & Industry 4.0',
        Credit: 2,
        Hrs: 20,
        SEC: 3,
        Program: 'PGPM',
        'Proposed Faculty': 'Dr. Laxminarayanan',
        'Junior Faculty': 'Mr. Abdul Khader',
      },
      {
        'Sub Code': 'PFIN111',
        'Course Name': 'Managerial Accounting',
        Credit: 1.5,
        Hrs: 15,
        SEC: 3,
        Program: 'PGPM',
        'Proposed Faculty': 'Dr. Vishwanathan Iyer',
        'Junior Faculty': 'Dr. Madhu Kumari',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample, { header: COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Courses');
    XLSX.writeFile(wb, 'courses-import-template.xlsx');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    bulk.reset();
    setParsing(true);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const parsed = json
        .map((r, i) => ({ ...normalizeRow(r), __row: i + 2 }))
        .filter((r) => r.code || r.title); // drop blank lines
      if (!parsed.length) throw new Error('No data rows found. Use the template and keep the header row.');
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || 'Could not read that file.');
      setRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setError('');
    try {
      await bulk.mutateAsync(rows);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" PaperProps={{ 'data-testid': 'bulk-courses-dialog' }}>
      <DialogTitle>Bulk add courses from Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {!result && (
            <Alert severity="info">
              Download the template, fill one row per course, then upload it. Only <b>Sub Code</b> and{' '}
              <b>Course Name</b> are required — credit, hours, sections and faculty are optional. Courses
              are added to the <b>active semester</b>; duplicate codes are skipped and reported.
            </Alert>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Step 1: template + upload */}
          {!result && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadTemplate} data-testid="bulk-courses-download-template">
                Download template
              </Button>
              <Button variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={parsing} data-testid="bulk-courses-choose-file">
                {parsing ? 'Reading…' : 'Choose Excel file'}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} data-testid="bulk-courses-file-input" />
            </Stack>
          )}

          {/* Step 2: preview parsed rows */}
          {!result && rows.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {fileName} · {rows.length} row{rows.length === 1 ? '' : 's'} ready to import
              </Typography>
              <TableContainer sx={{ maxHeight: 280, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                      <TableCell>Code</TableCell>
                      <TableCell>Course name</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Hrs</TableCell>
                      <TableCell align="right">Sec</TableCell>
                      <TableCell>Proposed faculty</TableCell>
                      <TableCell>Junior faculty</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.slice(0, 50).map((r) => (
                      <TableRow key={r.__row}>
                        <TableCell>{r.code || dash}</TableCell>
                        <TableCell>{r.title || dash}</TableCell>
                        <TableCell align="right">{r.credits || dash}</TableCell>
                        <TableCell align="right">{r.hours || dash}</TableCell>
                        <TableCell align="right">{r.sections || dash}</TableCell>
                        <TableCell sx={{ whiteSpace: 'pre-line' }}>{r.proposedFaculty || dash}</TableCell>
                        <TableCell sx={{ whiteSpace: 'pre-line' }}>{r.juniorFaculty || dash}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {rows.length > 50 && (
                <Typography variant="caption" color="text.secondary">
                  Showing first 50 of {rows.length}.
                </Typography>
              )}
            </Box>
          )}

          {/* Step 3: results */}
          {result && (
            <Box>
              <Alert severity={result.summary.failed ? 'warning' : 'success'} sx={{ mb: 2 }}>
                Imported <b>{result.summary.created}</b> of {result.summary.total} course
                {result.summary.total === 1 ? '' : 's'}
                {result.summary.failed ? `, ${result.summary.failed} skipped.` : '.'}
              </Alert>

              {result.failed.length > 0 && (
                <TableContainer sx={{ maxHeight: 240, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                        <TableCell>Row</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.failed.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell>{f.row}</TableCell>
                          <TableCell>{f.code || '—'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error">
                              {f.error}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {result ? (
          <>
            <Button onClick={reset}>Import another file</Button>
            <Button variant="contained" onClick={handleClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleImport} disabled={!rows.length || bulk.isPending} data-testid="bulk-courses-import">
              {bulk.isPending ? 'Importing…' : `Import ${rows.length || ''} course${rows.length === 1 ? '' : 's'}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
