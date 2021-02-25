const query = `{
    repository(name: "X", owner: "Y") {
      projects(first: 1) {
        nodes {
          name,
          columns(first: 10) {
            nodes {
              name,
              cards(first: 100) {
                totalCount,
                nodes {
                  column {
                    name
                  },
                  content {
                    ... on Issue {
                      url,
                      number,
                      title,
                      createdAt,
                      updatedAt,
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
  }
  `;

console.log(query.replace(/(\r\n|\n|\r)/gm, '').replace(/ /gm, '').replace(/"/gm, '\\"'));
