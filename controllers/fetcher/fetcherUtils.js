'use strict';

// const request = require('request');
const governify = require('governify-commons');
const logger = governify.getLogger().tag('fetcher-utils');
const sourcesManager = require('../sourcesManager/sourcesManager');
const _ = require('lodash');

const temporalDB = new Map();
const aux = []

function getTemporalDB(key) {
  logger.debug('TemporalDB aux before get: \n\t', JSON.stringify(aux, null, 2));
  logger.debug('TemporalDB before get key: \n\t', JSON.stringify(temporalDB.entries(), null, 2));
  const result = temporalDB.get(key);
  logger.debug('TemporalDB after get key: \n\t', JSON.stringify(temporalDB.entries(), null, 2));
  logger.debug('TemporalDB get result: \n\t', JSON.stringify(result));
  logger.debug('Getting TemporalDB: \n\t', JSON.stringify(key, null, 2), ' \n\t=====\n\t ', JSON.stringify(result, null, 2));
  logger.debug('TemporalDB aux after get: \n\t', JSON.stringify(aux, null, 2));
  return result;
};

function setTemporalDB(key, value) {
  logger.debug('Setting TemporalDB: \n\t', JSON.stringify(key, null, 2), ' \n\t=====\n\t ', JSON.stringify(structuredClone(value), null, 2));
  logger.debug('TemporalDB aux before set: \n\t', JSON.stringify(aux, null, 2));
  if (value !== undefined) {
    logger.debug('TemporalDB setting value: \n\t', JSON.stringify(structuredClone(value)));
  }
  temporalDB.set(key, structuredClone(value));
  aux.push({[new Date().getTime()]: structuredClone(value)});
  logger.debug('TemporalDB aux after set: \n\t', JSON.stringify(temporalDB.entries(), null, 2));
};

function deleteTemporalDB(key) {
  logger.debug('Deleting TemporalDB: \n\t', JSON.stringify(key, null, 2));
  temporalDB.delete(key);
};

function includesTemporalDB(key) {
  const result = temporalDB.has(key);
  logger.debug('TemporalDB includes: \n\t', JSON.stringify(key, null, 2), ' \n\t=====\n\t ', result);
  return result;
}

function hasValueTemporalDB(key) {
  const result = getTemporalDB(key) !== undefined;
  logger.debug('TemporalDB has value: \n\t', JSON.stringify(key, null, 2), ' \n\t=====\n\t ', result);
  return result;
}

const defaultOptions = {
  method: 'GET',
  headers: {}
};

// Retrieves data from an api based on an url, and a token
const requestWithHeaders = (url, extraHeaders, data = undefined) => {
  return new Promise((resolve, reject) => {
    // Cache key for GET and POST requests
    const cacheKey = !data ? url : url + JSON.stringify(data);

    if (includesTemporalDB(cacheKey)) {
      requestResolveCache(cacheKey).then(data => {
        resolve(data);
      }).catch(err => {
        reject(err);
      });
    } else {
      // Set temporal db to undefined for not requesting multiple times
      setTemporalDB(cacheKey, undefined);

      // Create request
      const options = { ...defaultOptions };
      options.headers = { ...defaultOptions.headers };

      // Add extra headers
      const extraHeaderKeys = Object.keys(extraHeaders);
      for (const key of extraHeaderKeys) {
        options.headers[key] = extraHeaders[key];
      }

      // If POST add options
      if (data) {
        options.method = 'POST';
        options.data = data;
      }

      // Add url
      options.url = url;

      // Pseudonymizer addition
      if (process.env.PSEUDONYMIZER_URL) {
        options.url = process.env.PSEUDONYMIZER_URL + options.url;
        options.headers['pseudonymizer-token'] = process.env.PSEUDONYMIZER_TOKEN;
      }

      // Make request
      governify.httpClient.request(options).then(res => {
        logger.debug('TemporalDB setting value: \n\t', JSON.stringify(structuredClone(res.data)));
        setTemporalDB(cacheKey, _.cloneDeep(res.data));
        setTimeout(() => {
          deleteTemporalDB(cacheKey);
        }, 10000);
        resolve(res.data);
      }).catch(err => {
        setTemporalDB(cacheKey, 'error');
        setTimeout(() => {
          deleteTemporalDB(cacheKey);
        }, 10000);
        reject(err);
      });
    }
  });
};

const requestResolveCache = (url) => {
  return new Promise((resolve, reject) => {
    if (!hasValueTemporalDB(url)) {
      setTimeout(() => {
        requestResolveCache(url).then(data => {
          resolve(data);
        }).catch(err => {
          reject(err);
        });
      }, 1000);
    } else if (getTemporalDB(url) === 'error') {
      reject(new Error('Invalid request'));
    } else {
      resolve(_.cloneDeep(getTemporalDB(url)));
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
      reject(new Error('filterMustMatch: Comparing mustMatch failed:\n' + err.message));
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
                logger.error('Item failed when filtering mustMatch:', err.message);
                logger.error('Item:', item);
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
