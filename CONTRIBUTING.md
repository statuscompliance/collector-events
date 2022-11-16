Ejemplo con redmine:

	1. Add key in ./configurations/authKeys.json:  "redmine":"$_[KEY_REDMINE]"
	2. Add desired endpoints in ./configurations/sourcesManager.json:

		"redmine": {
            	"newIssues": {
                		"endpoint": "/projects/{redmine.projectId}/issues.json", 
                		"payloadDate": "created_on"
            	},
            	"updatedIssues": {
                		"endpoint": "/projects/{redmine.projectId}/issues.json", 
                		"payloadDate": "updated_on"
            	},
            	"closedIssues": {
                		"endpoint": "/projects/{redmine.projectId}/issues.json?status_id=closed", 
                		"payloadDate": "closed_on"
            	},
            	"issuesMovedToInProgress": {
                		"endpoint": "/projects/{redmine.projectId}/issues.json", 
                		"payloadDate": "updated_on"
            	}
        	}

	3. Add minimal authkey in ./controllers/apiv2computationsControllerService.js:     redmine: ''
	4. Require the fetcher that will be created and add the corresponding "case" inside the "switch" in ./controllers/fetcher/fetcher.js:

		const redmineFetcher = require('./redmineFetcher');


		case 'redmine':
                redmineFetcher
                  .getInfo({
                    from: from,
                    to: to,
                    token: generateToken(integrations.redmine.apiKey, authKeys.redmine, ''),
                    endpoint: endpoint,
                    endpointType: endpointType,
                    mustMatch: mustMatch,
                  })
                  .then((data) => {
                    resolve(data);
                  }).catch(err => {
                    reject(err);
                  });
                break;

	5. Create the fetcher that has been required in ./controllers/fetcher/fetcher.js (see file: "./controllers/fetcher/redmineFetcher.js")
