const { getBalanceConfig } = require('@librechat/api');
const { findBalanceByUser, upsertBalanceFields } = require('~/models');

async function balanceController(req, res) {
  let balanceData = await findBalanceByUser(req.user.id);

  if (!balanceData) {
    const balanceConfig = getBalanceConfig(req.config);
    if (!balanceConfig?.enabled || balanceConfig.startBalance == null) {
      return res.status(204).end();
    }

    balanceData = await upsertBalanceFields(req.user.id, {
      tokenCredits: balanceConfig.startBalance,
      autoRefillEnabled: balanceConfig.autoRefillEnabled ?? false,
      refillIntervalValue: balanceConfig.refillIntervalValue,
      refillIntervalUnit: balanceConfig.refillIntervalUnit,
      refillAmount: balanceConfig.refillAmount,
      lastRefill: new Date(),
    });

    if (!balanceData) {
      return res.status(204).end();
    }
  }

  const { _id: _, ...result } = balanceData;

  if (!result.autoRefillEnabled) {
    delete result.refillIntervalValue;
    delete result.refillIntervalUnit;
    delete result.lastRefill;
    delete result.refillAmount;
  }

  res.status(200).json(result);
}

module.exports = balanceController;
