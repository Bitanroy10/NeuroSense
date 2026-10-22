// Vercel serverless entry: every /api/* request is handled by the shared backend.
module.exports = require('../server/server').handler;
