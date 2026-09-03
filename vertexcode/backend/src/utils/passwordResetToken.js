const crypto = require('crypto');

const TOKEN_TTL_MINUTES = 60;

// The raw token (high-entropy, 256 bits) is what gets emailed to the user
// and is never persisted. Only its SHA-256 hash is stored, so a compromised
// database alone can't be used to reset anyone's password — this is a
// lookup/comparison hash, not a password hash, so bcrypt (deliberately slow,
// meant to resist brute-forcing a low-entropy secret) is the wrong tool here;
// the token's own entropy is what makes it unguessable.
function generateResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  return { token, tokenHash, expiresAt };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateResetToken, hashResetToken, TOKEN_TTL_MINUTES };
