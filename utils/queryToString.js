const query = `{
  repository(name: "X", owner: "Y") {
    projects(first: 1) {
      nodes {
        name
        columns(first: 10) {
          nodes {
            name
            cards(first: 100) {
              totalCount
              nodes {
                column {
                  name
                }
                content {
                  ... on Issue {
                    url
                    number
                    title
                    createdAt
                    updatedAt
                    assignees(first: 10) {
                      nodes {
                        login 
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
  }
}`;

console.log(query.split('\n')
  .map(e => e.trim()) // Trimm
  .map(e => /[a-z]|[A-Z]|}/.test(e[e.length - 1]) ? e + ',' : e) // Add , if it ends with letter
  .reduce((a, b) => a + b)
); // Concat
