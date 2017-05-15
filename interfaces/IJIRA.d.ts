export namespace JIRA {

    export interface IAvatarUrls {
        "48x48": string;
        "24x24": string;
        "16x16": string;
        "32x32": string;
    }

    export interface IAuthor {
        self: string;
        name: string;
        key: string;
        accountId: string;
        emailAddress: string;
        avatarUrls: IAvatarUrls;
        displayName: string;
        active: boolean;
        timeZone: string;
    }


    export interface IUpdateAuthor {
        self: string;
        name: string;
        key: string;
        accountId: string;
        emailAddress: string;
        avatarUrls: IAvatarUrls;
        displayName: string;
        active: boolean;
        timeZone: string;
    }

    export interface IWorklog {
        self: string;
        author: IAuthor;
        updateAuthor: IUpdateAuthor;
        comment: string;
        created: Date|string;
        updated: Date|string;
        started: Date|string;
        timeSpent: string;
        timeSpentSeconds: number;
        id: string;
        issueId: string;
    }

    export interface IWorklogCollection {
        startAt: number;
        maxResults: number;
        total: number;
        worklogs: IWorklog[];
    }

    export interface IStatusCategory {
        self: string;
        id: number;
        key: string;
        colorName: string;
        name: string;
    }

    export interface IStatus {
        self: string;
        description: string;
        iconUrl: string;
        name: string;
        id: string;
        statusCategory: IStatusCategory;
    }

    export interface Fields {
        worklog: IWorklogCollection;
        status: IStatus;
    }

    export interface IIssue {
        expand: string;
        id: string;
        self: string;
        key: string;
        fields: Fields;
    }

    export interface IJIRA {
        expand: string;
        startAt: number;
        maxResults: number;
        total: number;
        issues: IIssue[];
    }

}