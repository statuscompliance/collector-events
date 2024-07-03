"use strict";

var varapiv2computationscomputationIdController = require("./apiv2computationscomputationIdControllerService");

module.exports.findComputationBycomputationId =
  function findComputationBycomputationId(req, res, next) {
    varapiv2computationscomputationIdController.findComputationBycomputationId(
      req.swagger.params,
      res,
      next
    );
  };
