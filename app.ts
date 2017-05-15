/**
 * Created by Kyle Karpack on 2/10/2017.
 */

/// <reference path="index.d.ts" />

// Import interfaces
import {IConfig} from "./interfaces/IConfig";

// Import node modules
import * as request from "request";
import * as moment from "moment";
import * as minimist from "minimist";
import * as Q from "Q";


// Get configuration
const config: IConfig = require("./config.json");

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
    targetDateString = args.d
} else {
    targetDate = moment();
    targetDateString = "startOfDay()";
}

// Constants
const url: string = `https://net-inspect.atlassian.net/rest/api/latest/search?fields=worklog&jql=worklogAuthor = currentUser() AND worklogDate = ${targetDateString}`;


// Run
request({
    url: url,
    headers: config.JIRA_HEADERS
}, (err, response) => {
    
   const body = JSON.parse(response.body);

   const jiraTaskMap = {};

    for (let issue of body.issues) {
        
        for (let log of issue.fields.worklog.worklogs) {
            
            // Ensure the day of the worklog is correct
            if (moment(log.created).isSame(targetDate, "d")) {
                if (jiraTaskMap[issue.key]) {
                    jiraTaskMap[issue.key].time += log.timeSpentSeconds;
                } else {
                    jiraTaskMap[issue.key] = {
                        date: new Date(log.created),
                        time: log.timeSpentSeconds   
                    };
                }
            }            
        }
    }

    console.log(`Found ${Object.keys(jiraTaskMap).length} issues with JIRA Tempo worklogs on ${targetDate.format("MM/DD/YYYY")}`);


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

        const projects = JSON.parse(response.body).projects;

        let wait = 0,
            output = [],
            promises = [];

        for (let project of projects) {
            
            const deferred = Q.defer();

            promises.push(deferred.promise);

            wait++;
            setTimeout(() => {
                request({
                    url: `https://api.projectmanager.com/api/v1/projects/${project.id}/tasks.json`,
                    headers: config.PM_HEADERS
                }, (err, tasks) => {
                    
                    if (err) {
                        console.error(err);
                    } else if (tasks.statusCode !== 200) {
                        console.error("ERROR", tasks.body);
                    } else {
                        tasks = JSON.parse(tasks.body);
                        tasks = tasks.tasks;

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

                        deferred.resolve();

                    }

                    deferred.reject();
                    
                });
            }, wait * 1500);

        }




        // Continue after all tasks mapped
        const proceed = (worklogs): any => {
            
            console.log(`Found ${worklogs.length} matching tasks in Project Manager on ${targetDate.format("MM/DD/YYYY")}`);
            console.log(`Proceeding to log work...`);

            let wait = 0,
                count = 0,
                promises = [];

            for (let worklog of worklogs) {
                wait++;

                const d: Date = worklog.jira.date;
                const key = worklog.key;
                const deferred = Q.defer();

                promises.push(deferred.promise);

                worklog.date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
                worklog.hours = worklog.jira.time / 60 / 60;

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
                            deferred.resolve();
                        }

                        deferred.reject();

                                                
                    });

                }, wait * 1500);

            };

            return Q.allSettled(promises);
            
        };


        Q.allSettled(promises).then((promises) => {
            proceed(output).then(() => {
                console.log("Success!");
            }, err => {
                console.log("Error!");
            });
        });



    });

});