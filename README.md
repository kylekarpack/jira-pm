# jira-pm

A simple application to log timesheet hours from JIRA to Project Manager automatically


### Installation:

```
npm install
```

Look in config.json and determine that the following three variables are specified:

- **JIRA_HEADERS** (Must be specific to your user)
- **PM_HEADERS** (The supplied ones will work)
- **RESOURCE_ID** (The integer ID of you as a resource on project manager)

### Usage:

For the current day:
```
node app.js
```
Or, for a specific date
```
node app.js -date=05/13/2017
```