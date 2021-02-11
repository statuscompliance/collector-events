var assert = require('assert');
var request = require('request');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');

var server = require('../server');
var nockController = require('./nockController');

// For skipping tests in case of failure
var skip = [];

describe('Array', function () {
  before((done) => {
    server.deploy('test').then(() => {
      nockController.instantiateMockups('test').then(() => {
        sinon.stub(console, "log");
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

  describe('#apiRestControllersNegativeTestRequest()', function () {
    apiRestNegativeControllersTest();
  });

  describe('#apiRestControllersNegativeTestCached()', function () {
    apiRestNegativeControllersTest();
  });

  after((done) => {
    server.undeploy(done);
  });
});

function apiRestControllersTest() {
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

function apiRestNegativeControllersTest() {
  const testRequests = JSON.parse(fs.readFileSync(path.join(__dirname, '/negativeTestRequests.json')));
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

      it('should respond with 202 or 200 OK on get computation with empty computation and correct error message (' + testRequest.name + ')', function (done) {
        try {
          assert.notStrictEqual(undefined, computationEP);

          const options = {
            url: 'http://localhost:8081' + computationEP,
            json: true,
            headers: {
              'User-Agent': 'request'
            }
          };

          getComputationV2(options.url, 20000).then(errorMessage => {
            try {
              assert.strictEqual(typeof errorMessage, typeof '');
              assert.strictEqual(errorMessage, testRequest.errorMessage);
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
function getComputationV2(computationURL, ttl) {
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
          } else if (res.statusCode === 200) {
            resolve(body.computations);
          } else if (res.statusCode == 400) {
            assert.deepStrictEqual(body.computations, []);
            resolve(body.errorMessage);
          } else {
            console.log.restore();
            console.log("Uncontrolled error");
            console.log(res.statusCode);
            console.log(res.response.computation);
            reject(new Error('Error when obtaining computation - ' + res.statusMessage));
          }
        });
      }, firstTimeout);
    } catch (err) {
      reject(err);
    }
  });
}