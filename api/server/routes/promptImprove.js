const express = require('express');
const { improvePromptText, PromptImproveError } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.post('/improve', requireJwtAuth, async (req, res) => {
  try {
    const result = await improvePromptText({ text: req.body?.text });
    return res.status(200).send(result);
  } catch (error) {
    if (error instanceof PromptImproveError) {
      return res.status(error.statusCode).send({ message: error.message, code: error.code });
    }

    return res.status(500).send({
      message: 'Failed to improve prompt.',
      code: 'PROMPT_IMPROVE_FAILED',
    });
  }
});

module.exports = router;
