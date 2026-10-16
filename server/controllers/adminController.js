const mongoose = require('mongoose');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

const {
  changeCredits,
  CreditServiceError,
} = require('../services/creditService');

// Escape special characters before using search input in a regex.
const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/stats
exports.getAdminStats = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      verifiedUsers,
      pendingUsers,
      adminUsers,
      newUsersLast7Days,
      creditStats,
    ] = await Promise.all([
      User.countDocuments(),

      // Preserve compatibility with older verified accounts.
      User.countDocuments({
        $or: [
          { isVerified: true },
          { isVerified: { $exists: false } },
        ],
      }),

      User.countDocuments({ isVerified: false }),

      User.countDocuments({ role: 'admin' }),

      User.countDocuments({
        createdAt: { $gte: sevenDaysAgo },
      }),

      User.aggregate([
        {
          $group: {
            _id: null,
            totalCredits: {
              // Preserve the existing fallback for legacy records.
              $sum: { $ifNull: ['$credits', 5] },
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      totalUsers,
      verifiedUsers,
      pendingUsers,
      adminUsers,
      newUsersLast7Days,
      totalCredits: creditStats[0]?.totalCredits ?? 0,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error.message);

    return res.status(500).json({
      error: 'Failed to fetch admin stats',
    });
  }
};

// GET /api/admin/users?search=&page=1&limit=10
exports.getAllUsers = async (req, res) => {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 10;

    // Limit search length and escape regex syntax.
    const search = String(req.query.search || '')
      .trim()
      .slice(0, 100);

    const filter = {};

    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), 'i');

      filter.$or = [
        { name: safeSearch },
        { username: safeSearch },
        { email: safeSearch },
      ];
    }

    const [users, totalMatchingUsers] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        page,
        limit,
        totalUsers: totalMatchingUsers,
        totalPages: Math.max(
          1,
          Math.ceil(totalMatchingUsers / limit)
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching user list:', error.message);

    return res.status(500).json({
      error: 'Failed to fetch users',
    });
  }
};

// GET /api/admin/users/:id
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid user ID',
      });
    }

    const user = await User.findById(id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user details:', error.message);

    return res.status(500).json({
      error: 'Failed to fetch user details',
    });
  }
};

// POST /api/admin/users/:id/credits
// Positive amount grants credits; negative amount deducts credits.
exports.adjustUserCredits = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid user ID',
      });
    }

    if (
      !Number.isSafeInteger(amount) ||
      amount === 0 ||
      Math.abs(amount) > 10000
    ) {
      return res.status(400).json({
        error: 'Amount must be a non-zero integer within 10,000 credits',
      });
    }

    if (
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 300
    ) {
      return res.status(400).json({
        error: 'A reason of 1–300 characters is required',
      });
    }

    const requestKey = req.get('Idempotency-Key');

    if (
      typeof requestKey !== 'string' ||
      !/^[a-zA-Z0-9._:-]{8,150}$/.test(requestKey)
    ) {
      return res.status(400).json({
        error: 'A valid Idempotency-Key header is required',
      });
    }

    const targetUser = await User.findById(id)
      .select('_id role')
      .lean();

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    if (targetUser.role === 'admin') {
      return res.status(403).json({
        error: 'Credit adjustments for admin accounts are not allowed',
      });
    }

    const result = await changeCredits({
      userId: targetUser._id,
      amount,
      type: 'admin_adjustment',
      description: description.trim(),
      createdBy: req.user._id,
      idempotencyKey:
        `admin-adjustment:${req.user._id}:${requestKey}`,
      metadata: {
        source: 'admin_dashboard',
      },
    });

    return res.status(200).json({
      message: result.duplicate
        ? 'This adjustment was already processed'
        : 'Credits adjusted successfully',
      balance: result.balance,
      transaction: result.transaction,
      duplicate: result.duplicate,
    });
  } catch (error) {
    console.error('Admin credit adjustment error:', error.message);

    if (error instanceof CreditServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: 'Failed to adjust credits',
    });
  }
};

// GET /api/admin/users/:id/credit-transactions?page=1&limit=20
exports.getUserCreditTransactions = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid user ID',
      });
    }

    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 20;

    const userExists = await User.exists({ _id: id });

    if (!userExists) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const filter = { user: id };

    const [transactions, totalTransactions] = await Promise.all([
      CreditTransaction.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      CreditTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      transactions,
      pagination: {
        page,
        limit,
        totalTransactions,
        totalPages: Math.max(
          1,
          Math.ceil(totalTransactions / limit)
        ),
      },
    });
  } catch (error) {
    console.error('Credit history error:', error.message);

    return res.status(500).json({
      error: 'Failed to fetch credit history',
    });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid user ID',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Preserve the existing rule protecting admin accounts.
    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Admin accounts are protected from deletion',
      });
    }

    await User.deleteOne({ _id: user._id });

    return res.status(200).json({
      message: 'User deleted successfully',
      deletedUserId: user._id,
    });
  } catch (error) {
    console.error('Error deleting user:', error.message);

    return res.status(500).json({
      error: 'Failed to delete user',
    });
  }
};