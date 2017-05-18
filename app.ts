/**
 * Created by Kyle Karpack on 2/10/2017.
 */

// Import interfaces
import {IConfig} from "./interfaces/IConfig";
import {JIRA} from "./interfaces/IJIRA";
import {ProjectManager} from "./interfaces/IProjectManager";

// Import node modules

import * as request from "request";
import * as moment from "moment";
import * as minimist from "minimist";
import * as Q from "Q";
import * as atob from "atob";


// Get configuration
const config: IConfig = require("./config.json"),
    start = new Date();

if (!config) {
    throw "Config file required (config.json)";
} else if (!config.JIRA_HEADERS) {
    throw "JIRA API headers required!";
} else if (!config.PM_HEADERS) {
    throw "Project Manager API headers required!";
} else if (!config.RESOURCE_ID) {
    throw "Project Manager resource ID required!";
}

// Get Passed arguments
const args = minimist(process.argv.slice(2));

let targetDate,
    targetDateString;

if (args.d) {
    targetDate = moment(args.d);
    if (!targetDate.isValid()) {
        throw `Could not parse provided date: ${args.d}`;
    }
    targetDateString = targetDate.format("YYYY-MM-DD");
} else {
    targetDate = moment();
    targetDateString = "endOfDay()";
}

// Constants
const url: string = `https://net-inspect.atlassian.net/rest/api/latest/search?fields=worklog,status&jql=worklogAuthor = currentUser() AND worklogDate = ${targetDateString}`;

// Get current user email from API headers
let auth: string = config.JIRA_HEADERS.Authorization,
    b64 = auth.split(" ")[1],
    decoded = atob(b64),
    email = decoded.split(":")[0].toLowerCase();


// Functions
const getJIRAWorklogs = (): Q.Promise<any> => {

    const deferred = Q.defer();

    request({
        url: url,
        headers: config.JIRA_HEADERS
    }, (err, response) => {

        if (err) {
            deferred.reject(null);
        }
        
        const body: JIRA.IJIRA = JSON.parse(response.body);

        const jiraTaskMap = {};

        for (let issue of body.issues) {
            
            for (let log of issue.fields.worklog.worklogs) {
                
                // Ensure the user of the worklog is correct
                if (log.author.emailAddress === email) {
                    // Ensure the day of the worklog is correct
                    if (moment(log.created).isSame(targetDate, "d")) {
                        if (jiraTaskMap[issue.key]) {
                            jiraTaskMap[issue.key].time += log.timeSpentSeconds;
                        } else {
                            jiraTaskMap[issue.key] = {
                                date: moment(log.created).toDate(),
                                time: log.timeSpentSeconds ,
                                status: issue.fields.status && issue.fields.status.name 
                            };
                        }
                    }     
                }

            }
        }

        deferred.resolve(jiraTaskMap);

    });

    return deferred.promise;

};


const getProjectManagerTasks = (jiraTaskMap): Q.Promise<any> => {

    const deferred = Q.defer();

     request({
        method: "GET",
        url: `https://api.projectmanager.com/api/v1/resources/${config.RESOURCE_ID}/assignedProjects.json`,
        headers: config.PM_HEADERS
    }, (err, response) => {

        if (err) {
            console.error(err);
            return;
        } else if (response.statusCode !== 200) {
            console.error(response.body);
            return;
        }

        let wait = 0,
            output = [],
            promises = [];

        const projects: ProjectManager.IProject[] = JSON.parse(response.body).projects;

        for (let project of projects) {
            
            const innerDeferred = Q.defer();

            promises.push(innerDeferred.promise);

            wait++;
            setTimeout(() => {
                request({
                    url: `https://api.projectmanager.com/api/v1/projects/${project.id}/tasks.json`,
                    headers: config.PM_HEADERS
                }, (err, response) => {
                    
                    if (err) {
                        console.error(err);
                    } else if (response.statusCode !== 200) {
                        console.error("ERROR", response.body);
                    } else {
                        let tasks: ProjectManager.ITask[] = JSON.parse(response.body).tasks;

                        for (let task of tasks) {
                            const key = task.name.split(" ")[0], 
                                jiraTask = jiraTaskMap[key];
                            if (jiraTask) { 
                                output.push({
                                    jira: jiraTask,
                                    taskId: task.id,
                                    projectId: project.id,
                                    adminTypeId: null,
                                    resourceId: config.RESOURCE_ID,
                                    key: key                                   
                                })          
                            }
                        }

                        innerDeferred.resolve();

                    }

                    innerDeferred.reject(null);
                    
                });
            }, wait * 1500);

        }

        Q.allSettled(promises).then(() => {
            deferred.resolve(output);
        }, err => {
            deferred.reject(null);
        });


    });

    return deferred.promise;

};


// Continue after all tasks mapped
const performLogging = (worklogs): Q.Promise<any> => {

    let wait = 0,
        count = 0,
        promises = [],
        deferred = Q.defer();

    for (let worklog of worklogs) {
        wait++;

        const key = worklog.key,
            innerDeferred = Q.defer();

        promises.push(innerDeferred.promise);

        worklog.date = moment(worklog.jira.date).format("YYYY-MM-DD");
        worklog.hours = Math.round(worklog.jira.time / 60 / 60 * 100) / 100;

        setTimeout(() => {
            request({
                method: "POST",
                url: `https://api.projectmanager.com/api/v1/timesheets.json`,
                headers: config.PM_HEADERS,
                form: worklog
            }, (err, response) => {

                count++;
                
                if (err) {
                    console.error("ERROR Logging work", err);
                } else if (response.statusCode !== 200) {
                    console.error(`Task ${key} does not exist!`);
                } else {
                    console.log(`Logged ${worklog.hours} hours for ${key} on ${moment(worklog.jira.date).format("MM/DD/YYYY")} (Task ${count}/${worklogs.length})`);
                    innerDeferred.resolve();
                }

                innerDeferred.reject(null);

                                        
            });

        }, wait * 1500);

    };

    Q.allSettled(promises).then(() => {
        deferred.resolve();
    }, err => {
        deferred.reject(null);
    });

    return deferred.promise;
    
};




// Run Application
getJIRAWorklogs().then((jiraTaskMap) => {

    console.log(`Found ${Object.keys(jiraTaskMap).length} issues with JIRA Tempo worklogs on ${targetDate.format("MM/DD/YYYY")}`);

    getProjectManagerTasks(jiraTaskMap).then((worklogs) => {

        console.log(`Found ${worklogs.length} matching tasks in Project Manager on ${targetDate.format("MM/DD/YYYY")}`);
        console.log(`\x1b[36m`, `Proceeding to log work...`, `\x1b[0m`);

        performLogging(worklogs).then(() => {
            console.log(`\x1b[42m`, `Success in ${new Date().getTime() - start.getTime()}ms!`, `\x1b[0m`);
        }, err => {
            console.log(`\x1b[41m`, `Error!`, `\x1b[0m`);
        });

    });

});