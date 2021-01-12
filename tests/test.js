var assert = require('assert');
var request = require('request');
var fs = require('fs');
var path = require('path');

var server = require('../server');
var nockController = require('./nockController');

// For skipping tests in case of failure
var skip = [];

describe('Array', function () {
  before((done) => {
    server.deploy('test').then(() => {
      nockController.instantiateMockups('test').then(() => {
        done();
      }).catch(err2 => {
        console.log(err2.message);
        done(err2);
      });
    }).catch(err1 => {
      console.log(err1.message);
      done(err1);
    });
  });

  describe('#apiRestControllersTestRequest()', function () {
    apiRestControllersTest();
  });

  describe('#apiRestControllersTestCached()', function () {
    apiRestControllersTest();
  });

  after((done) => {
    server.undeploy(done);
  });
});

function apiRestControllersTest () {
  const testRequests = JSON.parse(fs.readFileSync(path.join(__dirname, '/testRequests.json')));
  for (const testRequest of testRequests) {
    if (!skip.includes(testRequest.name)) {
      let computationEP;

      it('should respond with 200 OK on POST and have computation in body (' + testRequest.name + ')', function (done) {
        try {
          const options = {
            url: 'http://localhost:8081/api/v2/computations',
            json: testRequest.body,
            headers: {
              'User-Agent': 'request'
            }
          };
          request.post(options, (err, res, body) => {
            if (err) {
              assert.fail('Error on request');
            }
            assert.strictEqual(err, null);
            assert.strictEqual(res.statusCode, 200);
            assert.notStrictEqual(undefined, body.computation);
            computationEP = body.computation;
            done();
          });
        } catch (err) {
          assert.fail('Error when sending request');
        }
      });

      it('should respond with 202 or 200 OK on get computation and return correct metric value (' + testRequest.name + ')', function (done) {
        try {
          assert.notStrictEqual(undefined, computationEP);

          const options = {
            url: 'http://localhost:8081' + computationEP,
            json: true,
            headers: {
              'User-Agent': 'request'
            }
          };

          getComputationV2(options.url, 20000).then(computations => {
            try {
              // Some evidences may change
              const original = { ...testRequest.response };
              original[0].evidences = [];
              const response = { ...computations };
              response[0].evidences = [];
              assert.deepStrictEqual(original, response);
              done();
            } catch (err) {
              done(new Error('Error when comparing responses'));
            }
          }).catch(err => {
            assert.fail(err);
          });
        } catch (err) {
          assert.fail('Error when sending request');
        }
      });
    }
  }
}

// Auxiliary
function getComputationV2 (computationURL, ttl) {
  return new Promise((resolve, reject) => {
    try {
      if (ttl < 0) { reject(new Error('Retries time surpased TTL.')); }

      const realTimeout = 20; // Minimum = firstTimeout
      const firstTimeout = 10;
      const options = {
        json: true,
        url: computationURL,
        headers: {
          'User-Agent': 'request'
        }
      };

      setTimeout(() => {
        request(options, (err, res, body) => {
          if (err) {
            reject(err);
          }
          if (res.statusCode === 202) {
            setTimeout(() => {
              getComputationV2(computationURL, ttl - realTimeout).then(response => {
                resolve(response);
              }).catch(err => {
                reject(err);
              });
            }, realTimeout - firstTimeout);
          } else if (res.statusCode === 200) { resolve(body.computations); } else { reject(new Error('Error when obtaining computation - ' + res.statusMessage)); }
        });
      }, firstTimeout);
    } catch (err) {
      reject(err);
    }
  });
}
