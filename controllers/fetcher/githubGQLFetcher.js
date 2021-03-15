'use strict';

const fetcherUtils = require('./fetcherUtils');
const redisManager = require('./redisManager');

const apiUrl = 'https://api.github.com';
// const eventType = 'githubGQL';

// const requestCache = {};
// let cacheDate;

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
            console.log(err);
            cached = null;
          }
          if (step.cache && cached !== null) {
            console.log('Cached response!');
            resultData = cached;
          } else {
            console.log('Uncached response!');
            await getDataPaginated(step.query, options.token).then(data => {
              resultData = data;
              step.cache && redisManager.setCache(options.from + options.to + step.query, data);
            }).catch(err => {
              reject(err);
            });
          }
        } else if (step.type === 'objectGetSubObject' || step.type === 'objectGetSubObjects') {
          resultData = getSubObject(resultData, step.location);
        } else if (step.type === 'objectsFilterObject' || step.type === 'objectsFilterObjects') {
          resultData = getMatches(resultData, step.filters);
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
        }
      }
      resolve(resultData);
    } catch (err) {
      reject(err);
    }
  });
};
// Paginates github data to retrieve everything
// TODO - Pagination
const getDataPaginated = (query, token) => {
  return new Promise((resolve, reject) => {
    fetcherUtils.requestWithHeaders(apiUrl + '/graphql', { Authorization: token }, { query: query }).then((data) => {
      resolve(data);
    }).catch(err => {
      console.log(err);
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
    console.log(err);
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
    console.log(err);
    return undefined;
  }
};

exports.getInfo = getInfo;
