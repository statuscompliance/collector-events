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
        buildMockups(fs.readFileSync(path.join(__dirname, '/nockMockupsE2E.json'), 'utf-8'), '/nockMockupsE2E.json', true).then(() => {
          console.log("Loaded e2e mockups!");
          resolve();
        }).catch((err) => {
          console.log('Error when building Mockups! (nockMockupsE2E.json)');
          reject(err);
        });
      } catch (err) {
        console.log('No mockups file could be found! (nockMockupsE2E.json)');
        reject(err);
      }
    }
  });
};

const buildMockups = (mockups, filename, logs = false) => {
  return new Promise((resolve, reject) => {
    try {
      for (const mockup of JSON.parse(mockups)) {
        if (mockup.type === 'GET') {
          if (logs) {
            nock(mockup.requestAPI, { allowUnmocked: true }).log(console.log).get(mockup.requestEndpoint).reply(200, mockup.response);
          } else {
            nock(mockup.requestAPI, { allowUnmocked: true }).get(mockup.requestEndpoint).reply(200, mockup.response);
          }
        } else if (mockup.type === 'POST') {
          if (logs) {
            nock(mockup.requestAPI, { allowUnmocked: true }).log(console.log).post(mockup.requestEndpoint, mockup.body).reply(200, mockup.response);
          } else {
            nock(mockup.requestAPI, { allowUnmocked: true }).post(mockup.requestEndpoint, mockup.body).reply(200, mockup.response);
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
