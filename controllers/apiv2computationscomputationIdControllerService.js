'use strict';

const computationsControllerService = require('./apiv2computationsControllerService');

module.exports.findComputationBycomputationId = function findComputationBycomputationId (req, res, next) {
  try {
    computationsControllerService.getComputation(req.computationId.value).then(computation => {
      if (computation === null) {
        sendWithStatus(res, 202, 'Not ready yet.');
      } else if (computation === undefined) {
        sendWithStatus(res, 404, 'No computation with this id was found.');
      } else if (typeof computation === typeof []) {
        sendWithStatus(res, 200, 'OK', computation);
      } else if (typeof computation === typeof '') {
        sendWithStatus(res, 400, computation);
      } else {
        sendWithStatus(res, 500, 'Internal server error.');
      }
    }).catch(err => {
      console.log('error - findComputationById.getComputation:\n' + err);
      sendWithStatus(res, 500, 'Internal server error.');
    });
  } catch (err) {
    console.log('error - findComputationById:\n' + err);
    sendWithStatus(res, 500, 'Internal server error.');
  }
};

const sendWithStatus = (res, code, message, data) => {
  const toSend = {
    code: code,
    message: message
  };

  if (data !== undefined) { toSend.computations = data; }

  res.status(code);
  res.send(toSend);
};
