'use strict';

var varapiv2computationsController = require('./apiv2computationsControllerService');

module.exports.addComputation = function addComputation (req, res, next) {
  varapiv2computationsController.addComputation(req.swagger.params, res, next);
};
