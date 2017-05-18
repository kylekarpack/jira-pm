export interface IConfig {
    JIRA_HEADERS: IJIRAHeaders;
    PM_HEADERS: IProjectManagerHeaders;
    RESOURCE_ID: number|string;
}

interface IJIRAHeaders {
    Authorization: string;
}

interface IProjectManagerHeaders {
    apiKey: string;
}