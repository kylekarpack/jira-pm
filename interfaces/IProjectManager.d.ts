export module ProjectManager {

    export interface IProject {
        status: string;
        authorised: boolean;
        due: Date;
        id: number;
        name: string;
    }



    export interface IActual {
        cost: number;
        duration: number;
        effort: number;
        finish: Date;
        resourceCost: number;
        start: Date;
    }

    export interface ICustomColumn {
        name: string;
        type: string;
        data: string;
        extendedColumnId: number;
    }

    export interface IPlanned {
        cost: number;
        duration: number;
        effort: number;
        finish: Date;
        resourceCost: number;
        start: Date;
    }

    export interface ITask {
        children: any[];
        actual: IActual;
        assignments: number[];
        baseline?: any;
        isMilestone: boolean;
        isSummary: boolean;
        notes: string;
        customColumns: ICustomColumn[];
        percentComplete: number;
        planned: IPlanned;
        predeccesors?: any;
        priority: number;
        successors?: any;
        wbs: string;
        id: number;
        name: string;
    }


}

