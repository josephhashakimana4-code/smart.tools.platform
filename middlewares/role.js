module.exports = function role(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "SESSION_EXPIRED" });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ message: "ACCESS_DENIED" });
    }

    next();
  };
};
