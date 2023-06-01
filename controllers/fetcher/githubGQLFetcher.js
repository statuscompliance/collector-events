'use strict';

const fetcherUtils = require('./fetcherUtils');
const redisManager = require('./redisManager');
const logger = require('governify-commons').getLogger().tag('fetcher-githubGQL');

const apiUrl = 'https://api.github.com';

// Function who controls the script flow
const getInfo = (options) => {
  /* eslint-disable no-async-promise-executor */
  return new Promise(async (resolve, reject) => {
    /* eslint-enable no-async-promise-executor */
    try {
      let resultData;
      for (const stepNumber of Object.keys(options.steps)) {
        const step = options.steps[stepNumber];
        if (step.type === 'queryGetObject' || step.type === 'queryGetObjects') {
          let cached;
          try {
            cached = await redisManager.getCache(options.from + options.to + step.query);
          } catch (err) {
            logger.error(err);
            cached = null;
          }
          if (step.cache && cached) {
            resultData = cached;
          } else {
            await getDataPaginated(step.query, options.token).then(data => {
              resultData = data;
              step.cache && redisManager.setCache(options.from + options.to + step.query, data);
            }).catch(err => {
              reject(err);
            });
          }
        } else if (step.type === 'objectGetSubObject' || step.type === 'objectGetSubObjects') {
          if (options.debug || step.debug) {
            logger.info("STEP DEBUG: Step.location: ", step.location);
            logger.info("STEP DEBUG: ResultData before getSubObject: ", JSON.stringify(resultData));
          }
          resultData = getSubObject(resultData, step.location);
          if (options.debug || step.debug) logger.info("STEP DEBUG: ResultData after getSubObject: ", JSON.stringify(resultData));
        } else if (step.type === 'objectsFilterObject' || step.type === 'objectsFilterObjects') {
          if (options.debug || step.debug) {
            logger.info("STEP DEBUG: Step.filters: ", step.filters);
            logger.info("STEP DEBUG: ResultData before getMatches: ", JSON.stringify(resultData));
          }
          resultData = getMatches(resultData, step.filters);
          if (options.debug || step.debug) logger.info("STEP DEBUG: ResultData after getMatches: ", JSON.stringify(resultData));
          if (step.type === 'objectsFilterObject') {
            switch (step.keep) {
              case 'first': resultData = resultData[0]; break;
              case 'last': resultData = resultData[resultData.length - 1]; break;
              case 'min': resultData = resultData.sort()[0]; break;
              case 'max': resultData = resultData.sort()[resultData.length - 1]; break;
              case 'sum': resultData = resultData.reduce((a, b) => a + b); break;
              case 'avg': resultData = resultData.reduce((a, b) => a + b) / resultData.length; break;
              default:
            }
          }
        } else if (step.type === 'runScript') {
          if (options.debug || step.debug) {
            logger.info("STEP DEBUG: Step.script: ", step.script);
            logger.info("STEP DEBUG: Step.variables: ", JSON.stringify({ ...step.variables, from: options.from, to: options.to }));
            logger.info("STEP DEBUG: ResultData before runScript: ", JSON.stringify(resultData));
          }
          resultData = requireFromString(step.script).generic(resultData, { ...step.variables, from: options.from, to: options.to });
          if (options.debug || step.debug) logger.info("STEP DEBUG: ResultData after runScript: ", JSON.stringify(resultData));
        }
      }
      resolve(resultData);
    } catch (err) {
      logger.error(err);
      reject(err);
    }
  });
};

// Require() file from string
function requireFromString(src, filename = 'default') {
  var Module = module.constructor;
  var m = new Module();
  m._compile(src, filename);
  return m.exports;
}

// Paginates github data to retrieve everything
// TODO - Pagination
const getDataPaginated = (query, token) => {
  return new Promise((resolve, reject) => {
    const requestConfig = token ? { Authorization: token, Accept: 'application/vnd.github.starfox-preview+json' } : {};
    fetcherUtils.requestWithHeaders(apiUrl + '/graphql', requestConfig, { query: query }).then((data) => {
      resolve(data);
    }).catch(err => {
      logger.error(err);
      resolve(new Error('Failed when fetching to github.'));
    });
  });
};

const getMatches = (objects, filters) => {
  try {
    const matches = [];

    for (const object of objects) {
      let matched = true;
      for (const filter of filters) {
        const splitted = filter.split('==');
        const filterObjectLocation = splitted[0].replace(/'/gm, '').replace(/ /gm, '');
        const filterMustMatch = splitted[1].split("'")[1];

        if (filterObjectLocation.includes('*any*')) {
          let matched2 = false;
          const splitted2 = filterObjectLocation.split('.*any*.');

          for (const object2 of getSubObject(object, splitted2[0])) {
            if (getSubObject(object2, splitted2[1]) === filterMustMatch) {
              matched2 = true;
              break;
            }
          }
          matched = matched2;
        } else if (getSubObject(object, filterObjectLocation) !== filterMustMatch) {
          matched = false;
        }

        if (!matched) {
          break;
        }
      }
      matched && matches.push(object);
    }
    return matches;
  } catch (err) {
    logger.error(err);
    return [];
  }
};

const getSubObject = (object, location) => {
  try {
    if (location.includes('.')) {
      const splitted = location.split('.')[0];
      const newObject = object[splitted];

      if (!newObject) {
        return undefined;
      } else {
        return getSubObject(newObject, location.split(splitted + '.')[1]);
      }
    } else {
      return object[location];
    }
  } catch (err) {
    logger.error(err);
    return undefined;
  }
};

exports.getInfo = getInfo;
