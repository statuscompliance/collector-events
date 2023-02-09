const query = `{
  repository(owner: "matosan24", name: "bluejay-redmine-test") {
    projectsV2(first: 5) {
      nodes {
        items(first: 100) {
          nodes {
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldRepositoryValue {
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                  repository {
                    nameWithOwner
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  updatedAt
                  creator {
                    login
                  }
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

console.log(query.split('\n')
  .map(e => e.trim()) // Trimm
  .map(e => /[a-z]|[A-Z]|}/.test(e[e.length - 1]) ? e + ',' : e) // Add , if it ends with letter
  .reduce((a, b) => a + b)
); // Concat
