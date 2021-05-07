const nock = require('nock');
const fs = require('fs');
const path = require('path');

module.exports.instantiateMockups = (env) => {
  return new Promise((resolve, reject) => {
    if (env === 'test') {
      try {
        buildMockups(fs.readFileSync(path.join(__dirname, '/nockMockups.json'), 'utf-8'), '/nockMockups.json').then(() => {
          console.log("Loaded testing mockups!");
          resolve();
        }).catch((err) => {
          console.log('Error when building Mockups! (nockMockups.json)');
          reject(err);
        });
      } catch (err) {
        console.log('No mockups file could be found! (nockMockups.json)');
        reject(err);
      }
    } else if (env === 'e2e') {
      try {
        buildMockups(fs.readFileSync(path.join(__dirname, '/e2e/nockMockups.json'), 'utf-8'), '/e2e/nockMockups.json', true).then(() => {
          console.log("Loaded e2e mockups!");
          resolve();
        }).catch((err) => {
          console.log('Error when building Mockups! (/e2e/nockMockups.json)');
          reject(err);
        });
      } catch (err) {
        console.log('No mockups file could be found! (/e2e/nockMockups.json)');
        reject(err);
      }
    }
  });
};

const buildMockups = (mockups, filename, logs = false) => {
  return new Promise((resolve, reject) => {
    try {
      for (const mockup of JSON.parse(mockups)) { // TODO - Proper reply status code (add to requests.json)
        const responseCode = parseInt(mockup.response.code) || 200;
        if (mockup.type === 'GET') {
          if (logs) {
            nock(mockup.requestAPI, { allowUnmocked: true }).log(console.log).get(mockup.requestEndpoint).times(1000).reply(responseCode, mockup.response);
          } else {
            nock(mockup.requestAPI, { allowUnmocked: true }).get(mockup.requestEndpoint).times(1000).reply(responseCode, mockup.response);
          }
        } else if (mockup.type === 'POST') {
          if (logs) {
            nock(mockup.requestAPI, { allowUnmocked: true }).log(console.log).post(mockup.requestEndpoint, mockup.body).times(1000).reply(responseCode, mockup.response);
          } else {
            nock(mockup.requestAPI, { allowUnmocked: true }).post(mockup.requestEndpoint, mockup.body).times(1000).reply(responseCode, mockup.response);
          }
        }
      }
      resolve();
    } catch (err) {
      console.log('There was a problem when building up mockups (' + filename + ').', err);
      resolve();
    }
  });
};
