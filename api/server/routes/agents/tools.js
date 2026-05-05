const express = require('express');
const { callTool, verifyToolAuth, getToolCalls } = require('~/server/controllers/tools');
const { getAvailableTools } = require('~/server/controllers/PluginController');
const { toolCallLimiter } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

function toPublicTenantFunction(fn) {
  return {
    id: fn.id,
    name: fn.name,
    description: fn.description,
    details: fn.details,
    inputSchema: fn.inputSchema,
    isActive: fn.isActive,
  };
}

/**
 * Get a list of available tools for agents.
 * @route GET /agents/tools
 * @returns {TPlugin[]} 200 - application/json
 */
router.get('/', getAvailableTools);

/**
 * Get active tenant functions for the current user's tenant.
 * @route GET /agents/tenant-functions
 * @returns {TenantFunction[]} 200 - application/json
 */
router.get('/tenant-functions', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'User has no tenant' });
    }
    const functions = await db.getTenantFunctions({ tenantId, isActive: true });
    return res.json({ functions: functions.map(toPublicTenantFunction) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * Get a list of tool calls.
 * @route GET /agents/tools/calls
 * @returns {ToolCallData[]} 200 - application/json
 */
router.get('/calls', getToolCalls);

/**
 * Verify authentication for a specific tool
 * @route GET /agents/tools/:toolId/auth
 * @param {string} toolId - The ID of the tool to verify
 * @returns {{ authenticated?: boolean; message?: string }}
 */
router.get('/:toolId/auth', verifyToolAuth);

/**
 * Execute code for a specific tool
 * @route POST /agents/tools/:toolId/call
 * @param {string} toolId - The ID of the tool to execute
 * @param {object} req.body - Request body
 * @returns {object} Result of code execution
 */
router.post('/:toolId/call', toolCallLimiter, callTool);

module.exports = router;
