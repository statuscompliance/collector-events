'use strict';

const crypto = require('crypto');
const governify = require('governify-commons');
const logger = governify.getLogger().tag('computations-controller');
const fs = require('fs');
const mustache = require('mustache');
mustache.escape = function (text) { return text; };
const RRule = require('rrule').RRule
const rrulestr = require('rrule').rrulestr

const fetcher = require('./fetcher/fetcher');

const results = {};

// authKeys inicialization
let authKeys = {};

try {
  authKeys = JSON.parse(mustache.render(fs.readFileSync('./configurations/authKeys.json', 'utf-8'), process.env, {}, ['$_[', ']']));
} catch (err) {
  governify.getLogger().tag('startup').info('No configurations/scopeManager/authKeys.json found! Using default values.');
  // Minimal authKeys
  authKeys = {
    github: '',
    pivotal: '',
    heroku: '',
    travis: '',
    codeclimate: '',
    scopeManager: '',
    gitlab: '',
    redmine: ''
  };
}

if (process.env.PSEUDONYMIZER_URL) {
  process.env.PSEUDONYMIZER_TOKEN = authKeys.pseudonymizer;
}

module.exports.addComputation = function addComputation (req, res, next) {
  try {
    const dsl = req.metric.value;
    // Validate from and to
    validateInput(dsl).then(() => {
      getPeriods(dsl).then((periods) => {
        // results id instantiation
        const computationId = crypto.randomBytes(8).toString('hex');
        results[computationId] = null;

        // Request the integrations
        getScopeInfo(dsl.config.scopeManager, dsl.metric.scope).then(response => {
          const integrations = generateIntegrationsFromScopeInfo(response.scope);
          const members = response.scope.members;

          // Call to compute to calculate everything and insert it into results
          calculateComputations(dsl, periods, integrations, { ...authKeys }, members).then((computations) => {
            results[computationId] = computations;
          }).catch(err => {
            logger.error('addComputation.calculateComputations:\n' + err);
            results[computationId] = err.message;
          });
        }).catch(err => {
          logger.error('addComputation.getScopeInfo:\n' + err);
          results[computationId] = err.message;
        });

        // Send the computation URL
        res.status(200);
        res.send({
          code: 200,
          message: 'OK',
          computation: '/api/v2/computations/' + computationId
        });
      }).catch(err => {
        logger.error('addComputation.getPeriods:\n' + err);
        sendError(res, err, 400);
      });
    }).catch(err => {
      logger.error('addComputation.validateInput:\n' + err);
      sendError(res, err, 400);
    });
  } catch (err) {
    logger.error('addComputation:\n' + err);
    sendError(res, err, 500);
  }
};

module.exports.getComputation = (computationID) => {
  return new Promise((resolve, reject) => {
    try {
      resolve(results[computationID]);
      if (results[computationID] !== undefined && results[computationID] !== null) {
        delete results[computationID];
      }
    } catch (err) {
      reject(err);
    }
  });
};

const validateInput = (dsl) => {
  return new Promise((resolve, reject) => {
    try {
      const initial = dsl.metric.window.initial;
      const end = dsl.metric.window.end;

      var iso8601 = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.[0-9]+)?(Z)?$/;
      var iso8601Millis = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.[0-9]+)?\.([0-9][0-9][0-9])(Z)?$/;

      if (Date.parse(end) - Date.parse(initial) < 0) {
        reject(new Error('End period date must be later than the initial.'));
      } else if ((!iso8601.test(initial) && !iso8601Millis.test(initial)) || (!iso8601.test(end) && !iso8601Millis.test(end))) {
        reject(new Error('Dates must fit the standard ISO 8601.'));
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

const getPeriods = (dsl) => {
  return new Promise((resolve, reject) => {
    try {
      const initial = dsl.metric.window.initial;
      const end = dsl.metric.window.end;
      const windowPeriod = dsl.metric.window.period;
      const periods = [];
      
      if (windowPeriod === "customRuleDaily") {
        const ruleStr = dsl.metric.window.rule;
        let rule = rrulestr(ruleStr)

        for (const day of rule.all()) {

          if (day > new Date()) {
            break;
          }

          let dayFrom = new Date(day)
          dayFrom.setUTCHours(0)
          dayFrom.setUTCMinutes(0)
          dayFrom.setUTCSeconds(0)

          let dayTo = new Date(day)
          dayTo.setUTCHours(23)
          dayTo.setUTCMinutes(59)
          dayTo.setUTCSeconds(59)

          const fromStr = dayFrom.toISOString();
          const toStr = dayTo.toISOString();

          periods.push({ from: fromStr, to: toStr, originalFrom: fromStr, originalTo: toStr });
        }

      } else {
        // Translate period string to actual days and obtain number of periods
        const periodLengths = {
          daily: 1,
          weekly: 7,
          biweekly: 14,
          monthly: 30,
          bimonthly: 60,
          annually: 365
        };
        const periodLength = periodLengths[windowPeriod];
        if (periodLength === undefined) { reject(new Error('metric.window.period must be within these: daily, weekly, biweekly, monthly, bimonthly, annually.')); }
      


        // Obtain periods
        let fromStr = initial;
        let toDate;
        let toStr;

        let keepGoing = true;
        while (keepGoing) {
          // Set from after each iteration
          if (toStr !== undefined) {
            fromStr = toStr;
          }

          // Check if to is after end of periods
          toDate = new Date(Date.parse(fromStr) + periodLength * 24 * 60 * 60 * 1000);
          if (toDate >= new Date(Date.parse(end))) {
            toDate = new Date(Date.parse(end));
            keepGoing = false;
          }
          toStr = toDate.toISOString();

          // Push into the array
          periods.push({ from: fromStr, to: toStr, originalFrom: fromStr, originalTo: toStr });
        }
      }

      // Apply offset if needed
      if (typeof dsl.metric.offset === typeof 1) {
        for (const period of periods) {
          period.from = offsetDate(period.from, dsl.metric.offset);
          period.to = offsetDate(period.to, dsl.metric.offset);
        }
      }

      // Apply traceback if needed
      if (dsl.metric.element.value !== undefined && dsl.metric.element.value.traceback) {
        if (dsl.metric.element.value.return !== 'newest') {
          logger.warn('Traceback should be used with newest as return value!');
        }
        for (const period of periods) {
          period.from = '2016-01-01T00:00:00Z';
        }
      }

      resolve(periods);
    } catch (err) {
      reject(err);
    }
  });
};

const getScopeInfo = (url, scope) => {
  return new Promise((resolve, reject) => {
    try {
      const options = {
        method: 'GET',
        url: url + '/' + scope.class + '/' + scope.project,
        json: true,
        headers: {
          'User-Agent': 'request',
          Authorization: { ...authKeys }.scopeManager
        }
      };

      governify.httpClient.request(options).then(response => {
        resolve(response.data);
      }).catch(err => {
        if (err.response && err.response.status === 404) {
          if (scope) {
            reject(new Error('Project scope not found.\nProjectScopeId: ' + scope.project + ', ClassScopeId: ' + scope.class));
          } else {
            reject(new Error('Error: No scope was given.'));
          }
          logger.error('Scope Manager 404 Response:', err.response.data.message);
        } else {
          logger.error('Scope Manager Response:', err);
          reject(new Error('Failed when requesting to ScopeManager'));
        }
      });
    } catch (err) {
      if (scope) {
        reject(new Error('Failed when obtaining project scope.\nProjectScopeId: ' + scope.project + ', ClassScopeId: ' + scope.class));
      } else {
        reject(new Error('Error: No scope was given.'));
      }
      logger.error(err);
    }
  });
};

const generateIntegrationsFromScopeInfo = (scope) => {
  const integrations = {};

  for (const identity of scope.identities) {
    integrations[identity.source] = {};
    for (const itemI of Object.keys(identity)) {
      if (itemI !== 'source') { integrations[identity.source][itemI] = identity[itemI]; }
    }
  }

  for (const credential of scope.credentials) {
    for (const itemC of Object.keys(credential)) {
      if (itemC !== 'source') { integrations[credential.source][itemC] = credential[itemC]; }
    }
  }

  // console.log("INTEGRATIONS: ", integrations)

  return integrations;
};

const calculateComputations = (dsl, periods, integrations, authKeys, members) => {
  return new Promise((resolve, reject) => {
    try {
      const metric = dsl.metric;
      const promises = [];
      const computations = [];

      if (metric.scope.member === '*') {
        for (const period of periods) {
          for (const member of members) {
            const promise = new Promise((resolve, reject) => {
              fetcher.compute(metric, period.from, period.to, integrations, authKeys, member).then(result => {
                if (!isNaN(result.metric)) {
                  // Push computation
                  const resultScope = { ...metric.scope };
                  resultScope.member = member.memberId;

                  computations.push({
                    scope: resultScope,
                    period: {
                      from: period.originalFrom, to: period.originalTo
                    },
                    evidences: result.evidences,
                    value: result.metric
                  });
                }
                resolve();
              }).catch(err => {
                reject(err);
              });
            });
            promises.push(promise);
          }
        }
      } else {
        for (const period of periods) {
          const promise = new Promise((resolve, reject) => {
            fetcher.compute(metric, period.from, period.to, integrations, authKeys, undefined).then(result => {
              if (!isNaN(result.metric)) {
                // Push computation
                computations.push({
                  scope: metric.scope,
                  period: {
                    from: period.originalFrom, to: period.originalTo
                  },
                  evidences: result.evidences,
                  value: result.metric
                });

              }
              resolve();
            }).catch(err => {
              reject(err);
            });
          });
          promises.push(promise);
        }
      }
      
      Promise.all(promises).then(() => {
        resolve(computations);
      }).catch(err => {
        reject(err);
      });
    } catch (err) {
      reject(new Error('There was a problem obtaining computations.'));
    }
  });
};

const sendError = (res, err, code) => {
  res.status(code);
  res.send({
    code: code,
    computations: [],
    message: err.message,
    errorMessage: err.message
  });
};

const offsetDate = (date, offset) => { return new Date(Date.parse(date) + offset * 24 * 60 * 60 * 1000).toISOString(); };
