// express-async-errors already patches Express to catch async rejections,
// but this wrapper keeps intent explicit and works even without it.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
