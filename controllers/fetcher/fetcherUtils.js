'use strict';

const request = require('request');
const sourcesManager = require('../sourcesManager/sourcesManager');

const temporalDB = {};

const defaultOptions = {
  json: true,
  headers: {
    'User-Agent': 'request'
  }
};

// Retrieves data from an api based on an url, and a token
const requestWithHeaders = (url, extraHeaders) => {
  return new Promise((resolve, reject) => {
    if (Object.keys(temporalDB).includes(url)) {
      requestResolveCache(url).then(data => {
        resolve(data);
      }).catch(err => {
        reject(err);
      });
    } else {
      temporalDB[url] = undefined;

      const options = { ...defaultOptions };
      options.headers = { ...defaultOptions.headers };
      const extraHeaderKeys = Object.keys(extraHeaders);

      for (const key of extraHeaderKeys) {
        options.headers[key] = extraHeaders[key];
      }
      options.url = url;

      if (process.env.PSEUDONYMIZER_URL) {
        options.url = process.env.PSEUDONYMIZER_URL + options.url;
        options.headers['pseudonymizer-token'] = process.env.PSEUDONYMIZER_TOKEN;
      }

      request(options, (err, res, body) => {
        if (err) {
          temporalDB[url] = 'error';
          reject(err);
        }
        temporalDB[url] = body;
        setTimeout(() => {
          delete temporalDB[url];
        }, 6000);
        resolve(body);
      });
    }
  });
};

const requestResolveCache = (url) => {
  return new Promise((resolve, reject) => {
    if (temporalDB[url] === undefined) {
      setTimeout(() => {
        requestResolveCache(url).then(data => {
          resolve(data);
        }).catch(err => {
          reject(err);
        });
      }, 1000);
    } else if (temporalDB[url] === 'error') {
      reject(new Error('Invalid request'));
    } else {
      resolve(temporalDB[url]);
    }
  });
};
// Recursive function to see if item contains the items of mustMatch
const filterMustMatch = (item, mustMatch) => {
  return new Promise((resolve, reject) => {
    try {
      const rootKeys = Object.keys(mustMatch);
      let result = true;
      const promises = [];

      for (let i = 0; i < rootKeys.length; i++) {
        const actual = item[rootKeys[i]];
        const mustMatchActual = mustMatch[rootKeys[i]];

        if (actual === undefined) {
          if (JSON.stringify(mustMatchActual).includes('%SECOND%')) {
            // Ignore
          } else {
            result = false;
          }
        } else if (typeof actual === typeof {}) {
          const promise = new Promise((resolve, reject) => {
            filterMustMatch(actual, mustMatchActual).then((recursionResult) => {
              if (!recursionResult) {
                result = false;
              }
              resolve();
            }).catch(err => {
              reject(err);
            });
          });
          promises.push(promise);
        } else if (typeof mustMatchActual === typeof '') {
          if (mustMatchActual.includes('%ANYTHING%')) {
            // Ignore element
          } else if (mustMatchActual.includes('%SECOND%')) {
            // Ignore element
          } else if (mustMatchActual.match(/^#.*#$/g) !== null) { // any #XXX# string
            // Ignore element
          } else if (mustMatchActual.includes('%CONTAINS%')) {
            const mustIncludeThis = mustMatchActual.split('%CONTAINS%')[1];
            if (!actual.includes(mustIncludeThis)) { result = false; }
          } else if (mustMatchActual.includes('%HIGHER%')) {
            const thisMustBeLower = mustMatchActual.split('%HIGHER%')[1];
            if (thisMustBeLower >= actual) { result = false; }
          } else if (mustMatchActual.includes('%HIGHER_OR_EQUAL%')) {
            const thisMustBeLowerOrEqual = mustMatchActual.split('%HIGHER_OR_EQUAL%')[1];
            if (thisMustBeLowerOrEqual > actual) { result = false; }
          } else if (mustMatchActual.includes('%LOWER%')) {
            const thisMustBeHigher = mustMatchActual.split('%LOWER%')[1];
            if (thisMustBeHigher <= actual) { result = false; }
          } else if (mustMatchActual.includes('%LOWER_OR_EQUAL%')) {
            const thisMustBeHigherOrEqual = mustMatchActual.split('%LOWER_OR_EQUAL%')[1];
            if (thisMustBeHigherOrEqual < actual) { result = false; }
          } else {
            if (actual !== mustMatchActual) { result = false; }
          }
        } else if (actual !== mustMatchActual) {
          result = false;
        }

        if (!result) break;
      }

      // Give time to update result
      Promise.all(promises).then(() => {
        resolve(result);
      }).catch(err => {
        reject(err);
      });
    } catch (err) {
      reject(new Error('error - filterMustMatch: Comparing mustMatch failed:\n' + err.message));
    }
  });
};

const filterFromTo = (eventType, endpointType, event, from, to) => {
  return new Promise((resolve, reject) => {
    try {
      const fromDate = Date.parse(from);
      const toDate = Date.parse(to);
      const date = Date.parse(sourcesManager.getEventDate(eventType, endpointType, event));

      if (date > fromDate && date < toDate) resolve(true);
      else resolve(false);
    } catch (err) {
      reject(err);
    }
  });
};

// Applies all filters and returns the filtered data
const applyFilters = (data, from, to, mustMatch, endpointType, eventType, sort = true) => {
  return new Promise((resolve, reject) => {
    try {
      const filteredData = [];
      const promises = [];

      for (const item of data) {
        const promise = new Promise((resolve, reject) => {
          filterFromTo(eventType, endpointType, item, from, to).then(fromToBool => {
            if (fromToBool) {
              filterMustMatch(item, mustMatch).then(mustMatchBool => {
                if (mustMatchBool) {
                  filteredData.push(item);
                }
                resolve();
              }).catch(err => {
                console.log('Item failed when filtering mustMatch\n' + err.message);
                console.log(item);
                resolve();
              });
            } else {
              resolve();
            }
          }).catch(err => {
            reject(err);
          });
        });
        promises.push(promise);
      }

      Promise.all(promises).then(() => {
        // Sort from newest to oldest
        if (sort) {
          filteredData.sort((a, b) => Date.parse(sourcesManager.getEventDate(eventType, endpointType, b)) - Date.parse(sourcesManager.getEventDate(eventType, endpointType, a)));
        }
        resolve(filteredData);
      }).catch(err => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

exports.requestWithHeaders = requestWithHeaders;
exports.filterMustMatch = filterMustMatch;
exports.filterFromTo = filterFromTo;
exports.applyFilters = applyFilters;
