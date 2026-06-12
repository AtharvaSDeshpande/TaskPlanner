import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { useBulkCreateUsers } from '../queries/hooks.js';

// The columns the importer understands (header row of the template).
const COLUMNS = ['name', 'email', 'password', 'role', 'program', 'section', 'rollNumber', 'phone', 'enrollmentYear'];

// SheetJS is loaded on demand so it never bloats the main bundle.
const loadXLSX = () => import('xlsx');

// Normalises a raw sheet row: lowercases/strips header keys and maps aliases, so
// the import is resilient to header casing/spacing.
function normalizeRow(raw) {
  const o = {};
  for (const k of Object.keys(raw)) o[String(k).trim().toLowerCase().replace(/\s+/g, '')] = raw[k];
  return {
    name: o.name ?? o.fullname ?? '',
    email: o.email ?? o.emailusername ?? o.username ?? '',
    password: o.password ?? o.temppassword ?? '',
    role: o.role ?? '',
    program: o.program ?? '',
    section: o.section ?? '',
    rollNumber: o.rollnumber ?? o.rollno ?? o.roll ?? '',
    phone: o.phone ?? o.mobile ?? '',
    enrollmentYear: o.enrollmentyear ?? o.year ?? o.batch ?? '',
  };
}

export default function BulkAddUsersDialog({ open, onClose, domain }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const bulk = useBulkCreateUsers();
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
      { name: 'Jane Doe', email: 'jane.doe', password: '', role: 'student', program: 'PGDM', section: '1', rollNumber: 'PGDM-101', phone: '', enrollmentYear: '2026' },
      { name: 'Prof. Smith', email: 'smith@' + domain, password: '', role: 'moderator', program: 'MBA', section: '', rollNumber: '', phone: '', enrollmentYear: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample, { header: COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'users-import-template.xlsx');
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
        .filter((r) => r.name || r.email); // drop blank lines
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

  const downloadCredentials = async () => {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(
      result.created.map((c) => ({ name: c.name, email: c.email, role: c.role, password: c.password })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    XLSX.writeFile(wb, 'imported-user-credentials.xlsx');
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" PaperProps={{ 'data-testid': 'bulk-dialog' }}>
      <DialogTitle>Bulk add users from Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {!result && (
            <Alert severity="info">
              Download the template, fill one row per user, then upload it. The <b>password</b>{' '}
              column is optional — leave it blank and a random one is generated. Email may be a full
              address or just a username (we append <b>@{domain}</b>). Imported users must reset their
              password on first login.
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
              <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadTemplate} data-testid="bulk-download-template">
                Download template
              </Button>
              <Button variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={parsing} data-testid="bulk-choose-file">
                {parsing ? 'Reading…' : 'Choose Excel file'}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} data-testid="bulk-file-input" />
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
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Program</TableCell>
                      <TableCell>Section</TableCell>
                      <TableCell>Password</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.slice(0, 50).map((r) => (
                      <TableRow key={r.__row}>
                        <TableCell>{r.name || <em>—</em>}</TableCell>
                        <TableCell>{r.email ? (r.email.includes('@') ? r.email : `${r.email}@${domain}`) : <em>—</em>}</TableCell>
                        <TableCell>{r.role || 'student'}</TableCell>
                        <TableCell>{r.program || '—'}</TableCell>
                        <TableCell>{r.section || '—'}</TableCell>
                        <TableCell>{r.password ? '••••••' : <Chip size="small" label="auto" />}</TableCell>
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
                Imported <b>{result.summary.created}</b> of {result.summary.total} user
                {result.summary.total === 1 ? '' : 's'}
                {result.summary.failed ? `, ${result.summary.failed} failed.` : '.'} They must reset
                their password on first login.
              </Alert>

              {result.created.length > 0 && (
                <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadCredentials} sx={{ mb: 2 }}>
                  Download credentials ({result.created.length})
                </Button>
              )}

              {result.failed.length > 0 && (
                <TableContainer sx={{ maxHeight: 240, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'background.default' } }}>
                        <TableCell>Row</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.failed.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell>{f.row}</TableCell>
                          <TableCell>{f.email || '—'}</TableCell>
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
            <Button variant="contained" onClick={handleImport} disabled={!rows.length || bulk.isPending} data-testid="bulk-import">
              {bulk.isPending ? 'Importing…' : `Import ${rows.length || ''} user${rows.length === 1 ? '' : 's'}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
