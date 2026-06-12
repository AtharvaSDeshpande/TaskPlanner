// Defence-in-depth against NoSQL operator injection. Recursively strips any
// object keys beginning with "$" or containing "." from the request body, so a
// payload like { email: { "$gt": "" } } can never reach a Mongo query.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      out[key] = clean(val);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}
