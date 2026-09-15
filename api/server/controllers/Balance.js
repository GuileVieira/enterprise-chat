const { getBalanceConfig } = require('@librechat/api');
const { findBalanceByUser, upsertBalanceFields } = require('~/models');

async function balanceController(req, res) {
  const balanceLocals = res.locals || {};

  if (balanceLocals.balanceConfigEnabled === false) {
    return res.sendStatus(204);
  }

  let balanceData = balanceLocals.balanceData ?? (await findBalanceByUser(req.user.id));

  if (!balanceData) {
    if (balanceLocals.balanceConfigEnabled === true) {
      return res.status(404).json({ error: 'Balance not found' });
    }
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
