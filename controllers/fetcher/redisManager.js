const governify = require('governify-commons');
const redis = require('redis');

const redisClient = redis.createClient({
  url: governify.infrastructure.getServiceURL('internal.database.redis-ec'),
  retry_strategy: function (options) {
    if (options.attempt > 5) {
      return new Error('Retry attemps exhausted (5)');
    }
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.log('Error: Failed connecting to redis(ECONNREFUSED). Retrying in 1s');
      return 1000;
    }
    return 1000;
  }
});

redisClient.on('error', async function (error) {
  console.error(error);
});

const setCache = (key, value, ttl = undefined) => {
  return new Promise((resolve, reject) => {
    // Save cache
    if (redisClient.ready && redisClient.connected) {
      if (!ttl) {
        redisClient.set(key, JSON.stringify(value), (err, reply) => {
          if (err === null) {
            resolve();
          } else {
            reject(err);
          }
        });
      } else {
        redisClient.set(key, JSON.stringify(value), 'EX', ttl, (err, reply) => {
          if (err === null) {
            resolve();
          } else {
            reject(err);
          }
        });
      }
    } else {
      resolve();
    }
  });
};

const getCache = (key) => {
  return new Promise((resolve, reject) => {
    if (redisClient.ready && redisClient.connected) {
    // Find and return cache
      redisClient.get(key, (err, reply) => {
        if (err === null) {
          resolve(JSON.parse(reply));
        } else {
          reject(err);
        }
      });
    } else {
      resolve(null);
    }
  });
};

const delCache = (key) => {
  return new Promise((resolve, reject) => {
    if (redisClient.ready && redisClient.connected) {
    // Delete key
      redisClient.del(key, (err, reply) => {
        if (err === null) {
          resolve();
        } else {
          reject(err);
        }
      });
    } else {
      resolve(null);
    }
  });
};

exports.setCache = setCache;
exports.getCache = getCache;
exports.delCache = delCache;
