const express = require('express');
const { createAdminUsersHandlers } = require('@librechat/api');
const { runAsSystem, SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const { registerUser } = require('~/server/services/AuthService');
const { deleteUserData } = require('~/server/controllers/UserController');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);
const requireManageUsers = requireCapability(SystemCapabilities.MANAGE_USERS);

const handlers = createAdminUsersHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
  updateUser: db.updateUser,
  deleteUser: (req, userId) =>
    runAsSystem(async () => {
      const user = await db.getUserById(userId);
      if (!user) {
        return { deletedCount: 0, message: 'User not found' };
      }
      return deleteUserData(req, user);
    }),
});

router.use(requireJwtAuth, requireAdminAccess);

router.get('/', requireReadUsers, handlers.listUsers);
router.get('/search', requireReadUsers, handlers.searchUsers);
router.patch('/:id', requireManageUsers, handlers.updateUser);
router.delete('/:id', requireManageUsers, handlers.deleteUser);

router.post('/', requireManageUsers, async (req, res) => {
  try {
    const { email, name, username, password, tenantId, role } = req.body;
    if (!email || !name || !username) {
      return res.status(400).json({ message: 'Email, name, and username are required.' });
    }

    const generatedPassword = password || Math.random().toString(36).slice(-18);
    const additionalData = { emailVerified: true };
    if (tenantId) {
      additionalData.tenantId = tenantId;
    }
    if (role) {
      additionalData.role = role;
    }

    const result = await registerUser(
      { email, password: generatedPassword, name, username, confirm_password: generatedPassword },
      additionalData,
    );

    if (result.status !== 200) {
      return res.status(result.status).json({ message: result.message });
    }

    return res
      .status(201)
      .json({ message: 'User created successfully.', password: generatedPassword });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
