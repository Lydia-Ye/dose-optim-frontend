export interface ResultsPutRequest {
    patientID: string;
    pastAvgOutState: number[];
    pastUefmState: (number|null)[];
    pastWmftState: (number|null)[];
    pastDoseDataState: (number|null)[];
}