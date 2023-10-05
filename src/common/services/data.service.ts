import { Injectable } from "@angular/core";
import { map, merge, Observable, shareReplay, Subject } from "rxjs";

import { BleServiceFlag, IRowerData, IRowerDataDto, LogLevel } from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { WebSocketService } from "./websocket.service";

@Injectable({
    providedIn: "root",
})
export class DataService {
    private activityStartDistance: number = 0;
    private activityStartStrokeCount: number = 0;

    private batteryLevel: number = 0;
    private bleServiceFlag: BleServiceFlag = BleServiceFlag.FtmsService;

    private lastCalories: number = 0;
    private lastDistance: number = 0;
    private lastRevCount: number = 0;
    private lastRevTime: number = 0;
    private lastStrokeCount: number = 0;
    private lastStrokeTime: number = 0;

    private logLevel: LogLevel = LogLevel.Trace;

    private resetSubject: Subject<IRowerDataDto> = new Subject();

    private rowingData$: Observable<IRowerData>;

    constructor(private webSocketService: WebSocketService, private dataRecorder: DataRecorderService) {
        this.rowingData$ = merge(this.webSocketService.data(), this.resetSubject).pipe(
            map((rowerDataDto: IRowerDataDto): IRowerData => {
                const distance = Math.round(rowerDataDto.distance);
                const rowerData: IRowerData = {
                    bleServiceFlag: rowerDataDto.bleServiceFlag,
                    logLevel: rowerDataDto.logLevel,
                    driveDuration: rowerDataDto.driveDuration / 1e6,
                    recoveryDuration: rowerDataDto.recoveryDuration / 1e6,
                    avgStrokePower: rowerDataDto.avgStrokePower,
                    distance: rowerDataDto.distance - this.activityStartDistance,
                    batteryLevel: rowerDataDto.batteryLevel,
                    dragFactor: rowerDataDto.dragFactor,
                    strokeCount: rowerDataDto.strokeCount - this.activityStartStrokeCount,
                    totalCalories: rowerDataDto.totalCalories,
                    handleForces: rowerDataDto.handleForces,
                    peakForce: Math.max(...rowerDataDto.handleForces),
                    strokeRate:
                        ((rowerDataDto.strokeCount - this.lastStrokeCount) /
                            ((rowerDataDto.strokeTime - this.lastStrokeTime) / 1e6)) *
                        60,
                    speed:
                        (distance - this.lastRevCount) /
                        100 /
                        ((rowerDataDto.revTime - this.lastRevTime) / 1e6),
                    distPerStroke:
                        Math.round(rowerDataDto.distance) === this.lastRevCount
                            ? 0
                            : (distance - this.lastRevCount) /
                              100 /
                              (rowerDataDto.strokeCount - this.lastStrokeCount),
                };

                this.dataRecorder.add(rowerData);
                this.dataRecorder.addRaw(rowerDataDto);

                this.lastRevTime = rowerDataDto.revTime;
                this.lastRevCount = distance;
                this.lastStrokeTime = rowerDataDto.strokeTime;
                this.lastStrokeCount = rowerDataDto.strokeCount;
                this.lastDistance = rowerDataDto.distance;
                this.lastCalories = rowerDataDto.totalCalories;
                this.batteryLevel = rowerDataDto.batteryLevel;
                this.bleServiceFlag = rowerDataDto.bleServiceFlag;
                this.logLevel = rowerDataDto.logLevel;

                return rowerData;
            }),
            shareReplay()
        );
    }

    getBleServiceFlag(): BleServiceFlag {
        return this.bleServiceFlag;
    }

    getLogLevel(): LogLevel {
        return this.logLevel;
    }

    reset(): void {
        this.activityStartDistance = this.lastDistance;
        this.activityStartStrokeCount = this.lastStrokeCount;
        this.dataRecorder.reset();

        this.resetSubject.next({
            driveDuration: 0,
            recoveryDuration: 0,
            avgStrokePower: 0,
            distance: this.lastDistance,
            batteryLevel: this.batteryLevel,
            bleServiceFlag: this.bleServiceFlag,
            logLevel: this.logLevel,
            dragFactor: 0,
            strokeCount: this.lastStrokeCount,
            totalCalories: this.lastCalories,
            handleForces: [],
            revTime: this.lastRevTime,
            strokeTime: this.lastStrokeTime,
        });
    }

    rowingData(): Observable<IRowerData> {
        return this.rowingData$;
    }
}
