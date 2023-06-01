# Introduction
In case that we want to develop a new metric, we can easily test it without the need of calculating the metrics of the agreement each time.
In this example, we will modify an existing metric called "COUNT_INPROGRESSISSUES_MEMBER".

# Setup
All we need to setup the development environment for this tutorial is to deploy any of the Governify applications (in this case, we will be using Bluejay). So, the steps would be:
1. Run the docker-compose commands in order to deploy the infraestructure locally: ```docker-compose -f docker-bluejay/docker-compose-local.yaml --env-file .env up -d --build```
2. Stop the container that corresponds to the collector being used (in this case, collector-events).
3. Open the collector locally and run ```node index.js``` in order to deploy the collector service locally. It will automatically connect to the docker network.
4. Open Postman and create a new tab with the following configuration:

```POST localhost:5500/api/v2/computations```

Body --> Raw --> JSON:

```
{
    "config": {
        "scopeManager": "http://host.docker.internal:5700/api/v1/scopes/development"
    },
    "metric": { <-- Metric that will be calculated by the collector
        "computing": "actual",
        "element": "number",
        "event": {
            "githubGQL": {
                "custom": {
                    "type": "graphQL",
                    "title": "Get issues in progress",
                    "steps": {
                        "0": {
                            "type": "queryGetObject",
                            "query": "{repository(name: \"%PROJECT.github.repository%\", owner: \"%PROJECT.github.repoOwner%\") {\r\n    projectsV2(first: 5) {\r\n      nodes {\r\n        items(first: 100) {\r\n          nodes {\r\n            content {\r\n              ... on Issue {\r\n                bodyText\r\n                updatedAt\r\n                number\r\n                author {\r\n                  login\r\n                }\r\n                assignees(first: 5  ) {\r\n                    nodes {\r\n                        login\r\n                    }\r\n                }\r\n              }\r\n            }\r\n            fieldValues(first: 100) {\r\n              nodes {\r\n                ... on ProjectV2ItemFieldUserValue {\r\n                    field {\r\n                        ... on ProjectV2Field {\r\n                            name\r\n                        }\r\n                    }\r\n                }\r\n                ... on ProjectV2ItemFieldRepositoryValue {\r\n                  field {\r\n                    ... on ProjectV2Field {\r\n                      name\r\n                    }\r\n                  }\r\n                  repository {\r\n                    nameWithOwner\r\n                  }\r\n                }\r\n                ... on ProjectV2ItemFieldTextValue {\r\n                  text\r\n                  field {\r\n                    ... on ProjectV2Field {\r\n                      name\r\n                    }\r\n                  }\r\n                }\r\n                ... on ProjectV2ItemFieldMilestoneValue {\r\n                    field {\r\n                        ... on ProjectV2Field {\r\n                            name\r\n                        }\r\n                    }\r\n                    milestone {\r\n                        number\r\n                        title \r\n                    }\r\n                }\r\n                ... on ProjectV2ItemFieldSingleSelectValue {\r\n                  name\r\n                  updatedAt\r\n                  creator {\r\n                    login\r\n                  }\r\n                  field {\r\n                    ... on ProjectV2SingleSelectField {\r\n                      name\r\n                    }\r\n                  }\r\n                }\r\n              }\r\n            }\r\n          }\r\n        }\r\n      }\r\n    }\r\n  }\r\n}",
                            "cache": true
                        },
                        "1": {
                            "type": "objectGetSubObjects",
                            "location": "data.repository.projectsV2.nodes.0.items.nodes"
                        },
                        "2": {
                            "type": "objectsFilterObjects",
                            "filters": [
                                "content.assignees.nodes.0.login == '%MEMBER.github.username%'"
                            ]
                        },
                        "3": {
                            "type": "runScript",
                            "variables": {},
                            "script": "module.exports.generic = function getFieldValues(inputData, variables) {\r\n    let result = [];\r\n    for (const issue of inputData) {\r\n        for (const fieldValue of issue.fieldValues.nodes) {\r\n            if (fieldValue.name === 'In Progress') {\r\n                if (new Date(fieldValue.updatedAt) > new Date(variables.from) && new Date(fieldValue.updatedAt) < new Date(variables.to)) {\r\n                    result.push(issue);\r\n                }\r\n            }\r\n        }\r\n    }\r\n    return result;\r\n}"
                        }
                    }
                }
            }
        },
        "scope": {
            "project": "Bluejay-2023-showcase-GH-governifyauditor_Bluejay-2023-showcase", <-- ID of the project that will be tested
            "class": "template", <-- Class of the project that will be tested
            "member": "*" <-- Add this if the metric is calculated for each member
        },
        "window": {
            "period": "hourly/daily/weekly/biweekly/monthly/bimonthly/annually", <-- Choose the period for the calculation
            "initial": "2023-01-01T23:00:00.000Z", <-- Set the start of the period
            "end": "2023-12-31T22:59:58.999Z", <-- Set the end of the period
            "timeZone": "America/Los_Angeles" <-- Set the time zone for the calculation
        }
    }
}
```

It should look like this:

![image](https://user-images.githubusercontent.com/63660411/236625837-364532c5-3aa0-49c8-8021-9da2931a114d.png)

Now we are ready to start testing our metric!

_(NOTE: If you want to have more information about the metric calculation process, you can set the logging level to debug in each microservice that you need via Postman executing the following request:_
```
POST http://localhost:5400/commons/logger/config
Body -> Raw -> JSON:
{
    "type": true,
    "tracing": true,
    "timestamp": true,
    "tags": true,
    "level": 1,
    "storage": {
        "active": true,
        "level": 1
    }
}
```
_where the numbers of the levels indicate the priority of the logs as follows:_
```
DEBUG: 1,
INFO: 2,
WARN: 3,
ERROR: 4,
FATAL: 5,
```
![image](https://github.com/governify/collector-events/assets/63660411/c4ce9790-c85d-468f-b355-91a5ffeb03a5)

_For example, you can check the repo being called if you take a look at the logs: ```Fetcher.getEventsFromJson: Performing GraphQL request to repository:  governifyauditor/Bluejay-2023-showcase```. Also, if you need to escape/unescape the GitHub GraphQL queries, you can use the following web: https://www.freeformatter.com/json-escape.html#before-output )_

# Developing

Now that we have set up our development environment, we can modify our metric as we want. Whenever we want to check what our metric returns, we can follow these simple steps:
1. Click on the "Send" button in Postman. This will return a response that looks like this:
```
{
    "code": 200,
    "message": "OK",
    "computation": "/api/v2/computations/39a76b982f9e2c87"
}
```
_(If there are any errors, you will need to fix them before continuing)_

2. Click on the computation URL. This will open another Postman tab with a GET to that link.
3. Click on the "Send" button in that new tab.
4. You can now check the response from the collector! Here is the response it gave me for the metric of the example:

![image](https://user-images.githubusercontent.com/63660411/236626258-380568ba-463e-46d3-be7d-183a0a16e229.png)

_(NOTE: The computations are deleted after you GET them once. If you want to test the metric again, you will need to perform another POST to the computations endpoint)_

# Updating the metric

Now that we have out metric working as desired, we will need to update our TPAs that use the old or unexisting metric. For this purpose, we will use the "Prueba de tareas" view in the Admin UI in Bluejay:

![image](https://user-images.githubusercontent.com/63660411/236626542-8956a091-4a29-418b-8ce2-d5e4204f761b.png)

In the "Script Text" (left) text area, we will need to copy the following content:

```
"use strict";
const governify = require('governify-commons');
const axios = require('axios');

/** Config Schema:
 *  {
 *    template: "template name or url",
 *    mode: "create|replace"
 *    agreementId: "agreementId|agreementRegex",
 *    classId: "classId (create only)",
 *  }
 */
module.exports.main = async (config) => {

    // Checkers
    if (!config.template) return "Missing template parameter";
    if (!config.agreementId) return "Missing agreementId parameter";
    if (!config.mode) return "Missing mode parameter";
    if (config.mode === "create" && !config.classId) return "Missing classId parameter for create mode";

    const assetsUrl = `${governify.infrastructure.getServiceURL("internal.assets")}/api/v1/public/renders/tpa/`;
    const registryUrl = `${governify.infrastructure.getServiceURL("internal.registry")}/api/v6/agreements`;
    const templateUrl = (config.template.startsWith("http") ? "" : assetsUrl) + (config.template.includes(".json") ? config.template : `${config.template}.json`);

    const template = await axios.get(templateUrl).then(res => res.data).catch(() => {});
    if (!template) return "Error getting template file";


    if (config.mode === "create") {
        const tpa = JSON.stringify(template).replace(/1010101010/g, config.agreementId).replace(/2020202020/g, config.classId);
        return await axios.post(`${registryUrl}`, JSON.parse(tpa)).then(() => "Agreement created").catch(() => "Error creating agreement");
    } else if (config.mode === "replace") {
        const tpas = await axios.get(`${registryUrl}`).then(res => res.data?.filter(t => new RegExp(config.agreementId).test(t.id)) ?? []).catch(() => []);
        const errors = [];

        for (const tpa of tpas) {
            await axios.delete(`${registryUrl}/${tpa.id}`).then(() => {
                const tpaId = tpa.id.replace("tpa-", "");
                const classId = tpa.context.definitions.scopes.development.class.default;
                const newTpa = JSON.parse(JSON.stringify(template).replace(/1010101010/g, tpaId).replace(/2020202020/g, classId));
                return axios.post(`${registryUrl}`, newTpa).catch(() => errors.push(`Error on creation while replacing agreement ${tpa.id}`));
            }).catch(() => errors.push(`Error on deletion while replacing agreement ${tpa.id}`));            
        }

        if (errors.length > 0) return "ERRORS:\n" + errors.join("\n");
        else return "Agreements replaced";

    } else {
        return "Invalid mode parameter (create|replace)";
    }
}
```
In the "Script Configuration" (right) text area, we will need to insert the configuration for the replacing script (instructions are on the first lines of the previous code).
With the "template" parameter, we indicate the name of the template in the "Assets Manager" that will be read in order to modify the TPAs.
We will set the mode to replace because we will be updating the TPAs. If they didn't exist, we could set the mode to "create" as mentioned in the prior script):
In this case, we want the script to modify the TPAs which follow the regex "psg2-2223" (i.e. the ones that contain that string in their IDs).
So the right part would be something like this:

```
{
  "template": "PSG2-2023",
  "mode": "replace",
  "agreementId": "psg2-2223"
}
```

![image](https://user-images.githubusercontent.com/63660411/236626957-a797e112-d8c0-4941-b3e5-0b7a1ca21c6b.png)

We cannot forget to modify the template that we have indicated with the metric we developed earlier. In this case, the template can be found here:

![image](https://user-images.githubusercontent.com/63660411/236627121-748addf7-da88-4078-85f0-20da57e4ef25.png)

Once we have modified our template, we can click on the "Test" button in the "Test Task" view and wait for the result. If there weren't any errors, you should see something like this:

![image](https://user-images.githubusercontent.com/63660411/236627821-7c50c167-0b1b-4726-99b1-f82f6d62ad40.png)

This means all the TPAs were updated successfully!
