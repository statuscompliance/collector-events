const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const governify = require('governify-commons')

const server = require('../server');
const nockController = require('./nockController');

const serverUrl = "http://localhost:5500";

// For skipping tests in case of failure
const skip = [];
const keep = []

describe('Array', function () {
  before((done) => {
    governify.init().then((commonsMiddleware) => {
      server.deploy('test', commonsMiddleware).then(() => {
        nockController.instantiateMockups('test').then(() => {
          sinon.stub(console);
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
    if ((keep.length === 0 && !skip.includes(testRequest.name)) || (keep.length !== 0 && keep.includes(testRequest.name))) {
      let computationEP;

      it('should respond with 200 OK on POST and have computation in body (' + testRequest.name + ')', function (done) {
        try {
          const options = {
            method: 'POST',
            url: serverUrl + '/api/v2/computations',
            data: testRequest.body,
            headers: {
              'User-Agent': 'request'
            }
          };

          governify.httpClient.request(options).then(response => {
            assert.strictEqual(response.status, 200);
            assert.notStrictEqual(undefined, response.data.computation);
            computationEP = response.data.computation;
            done();
          }).catch(err => {
            assert.fail('Error on request');
          });
        } catch (err) {
          assert.fail('Error when sending request');
        }
      });

      it('should respond with 202 or 200 OK on get computation and return correct metric value (' + testRequest.name + ')', function (done) {
        try {
          assert.notStrictEqual(undefined, computationEP);
          getComputationV2(serverUrl + computationEP, 20000).then(computations => {
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
    if ((keep.length === 0 && !skip.includes(testRequest.name)) || (keep.length !== 0 && keep.includes(testRequest.name))) {
      let computationEP;

      it('should respond with 200 OK on POST and have computation in body (' + testRequest.name + ')', function (done) {
        try {
          const options = {
            method: 'POST',
            url: serverUrl + '/api/v2/computations',
            data: testRequest.body,
            headers: {
              'User-Agent': 'request'
            }
          };
          governify.httpClient.request(options).then(response => {
            assert.strictEqual(response.status, 200);
            assert.notStrictEqual(undefined, response.data.computation);
            computationEP = response.data.computation;
            done();
          }).catch(err => {
            console.log(err)
            assert.fail('Error on request');
          });
        } catch (err) {
          assert.fail('Error when sending request');
        }
      });

      it('should respond with 202 or 200 OK on get computation with empty computation and correct error message (' + testRequest.name + ')', function (done) {
        try {
          assert.notStrictEqual(undefined, computationEP);
          getComputationV2(serverUrl + computationEP, 20000).then(errorMessage => {
            try {
              console.log("\n-------------------------------\nError Message:");
              console.log(errorMessage);
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
        url: computationURL,
        headers: {
          'User-Agent': 'request'
        }
      };

      setTimeout(() => {
        governify.httpClient.request(options).then(httpResponse => {
          if (httpResponse.status === 202) {
            setTimeout(() => {
              resolve(getComputationV2(computationURL, ttl - realTimeout));
            }, realTimeout - firstTimeout);
          } else if (httpResponse.status === 200) {
            resolve(httpResponse.data.computations);
          }
        }).catch(err => {
          if (err.response.status == 400) {
            assert.deepStrictEqual(err.response.data.computations, []);
            resolve(err.response.data.errorMessage);
          } else {
            console.log.restore();
            console.log("Uncontrolled error");
            console.log(err.response.status);
            console.log(err.response.data.computation);
            reject(new Error('Error when obtaining computation - ' + err));
          }
        });
      }, firstTimeout);
    } catch (err) {
      reject(err);
    }
  });
}