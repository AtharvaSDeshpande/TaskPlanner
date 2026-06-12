import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import api from '../api/client.js';

// Async member picker for groups: type a name / email / roll number and choose
// one or more organization members. `value`/`onChange` carry an array of user
// objects ({ id, name, email, rollNumber, … }). Search is debounced and the
// backend does the matching (server-side filterOptions = identity).
export default function UserSearchAutocomplete({
  value,
  onChange,
  excludeIds = [],
  label = 'Add members',
  placeholder = 'Search by name, email or roll number',
  helperText,
  testId,
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const excludeKey = excludeIds.join(',');

  // Debounce the typed text so each keystroke isn't a request.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    if (query.length < 1) {
      setOptions([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const params = { q: query, ...(excludeKey ? { exclude: excludeKey } : {}) };
    api
      .get('/groups/search-users', { params })
      .then((r) => active && setOptions(r.data.users || []))
      .catch(() => active && setOptions([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, excludeKey]);

  // Keep already-selected users present as options so their chips render even
  // after the search results change.
  const merged = useMemo(() => {
    const seen = new Set(options.map((o) => o.id));
    return [...options, ...value.filter((v) => !seen.has(v.id))];
  }, [options, value]);

  return (
    <Autocomplete
      multiple
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={input}
      onInputChange={(_, v) => setInput(v)}
      options={merged}
      loading={loading}
      filterOptions={(x) => x}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionLabel={(o) => o.name || o.email || ''}
      noOptionsText={query.length < 1 ? 'Type to search…' : 'No matching members'}
      renderOption={(props, o) => (
        // eslint-disable-next-line react/jsx-props-no-spreading
        <Box component="li" {...props} key={o.id}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {o.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {o.email}
              {o.rollNumber ? ` · ${o.rollNumber}` : ''}
              {o.program ? ` · ${o.program}` : ''}
              {o.section ? `-${o.section}` : ''}
            </Typography>
          </Box>
        </Box>
      )}
      renderTags={(val, getTagProps) =>
        val.map((o, i) => {
          const { key, ...tagProps } = getTagProps({ index: i });
          return <Chip key={o.id} size="small" label={o.name || o.email} avatar={undefined} {...tagProps} />;
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length ? '' : placeholder}
          helperText={helperText}
          inputProps={{ ...params.inputProps, 'data-testid': testId }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
