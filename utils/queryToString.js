const query = `{
  repository(name: "%PROJECT.github.repository%", owner: "%PROJECT.github.repoOwner%") {
    issues(first: 100) {
      nodes {
        timelineItems(last: 100) {
          nodes {
            ... on MovedColumnsInProjectEvent {
              id
              createdAt
              projectColumnName
              previousProjectColumnName 
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
