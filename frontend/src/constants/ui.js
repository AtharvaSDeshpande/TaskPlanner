// Spread onto a MUI <TextField select> that always shows content even when
// "empty" — i.e. a multiselect with `displayEmpty`/`renderValue`, or a select
// with a "— None —" / "All …" option (value=""). It keeps the label shrunk
// (floated above) and the outlined notch open, so the label never overlaps the
// placeholder/selected text in the middle of the field.
export const FLOATING_SELECT = {
  InputLabelProps: { shrink: true },
  InputProps: { notched: true },
};
