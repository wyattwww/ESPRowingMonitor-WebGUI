import { Injectable } from "@angular/core";
import { map, merge, Observable, shareReplay, Subject, withLatestFrom } from "rxjs";

import {
    AutoDragFactor,
    BleServiceFlag,
    IHeartRate,
    IRowerData,
    IRowerDataDto,
    LogLevel,
} from "../common.interfaces";

import { DataRecorderService } from "./data-recorder.service";
import { HeartRateService } from "./heart-rate.service";
import { WebSocketService } from "./websocket.service";

@Injectable({
    providedIn: "root",
})
export class DataService {
    private activityStartDistance: number = 0;
    private activityStartStrokeCount: number = 0;

    private autoDragFactor: AutoDragFactor = AutoDragFactor.Enabled;
    private batteryLevel: number = 0;
    private bleServiceFlag: BleServiceFlag = BleServiceFlag.FtmsService;
    private dragFactor: number = 101.0;
    private flywheelInertia: number = 0.125;

    private heartRateData$: Observable<IHeartRate | undefined>;
    private lastCalories: number = 0;
    private lastDistance: number = 0;
    private lastElapsedTime: number = 0;
    private lastRevCount: number = 0;
    private lastRevTime: number = 0;
    private lastStrokeCount: number = 0;
    private lastStrokeTime: number = 0;

    private logLevel: LogLevel = LogLevel.Trace;

    private magicNumber: number = 2.50;

    private resetSubject: Subject<IRowerDataDto> = new Subject();

    private rowingData$: Observable<IRowerData>;

    constructor(
        private webSocketService: WebSocketService,
        private dataRecorder: DataRecorderService,
        private heartRateService: HeartRateService,
    ) {
        this.heartRateData$ = this.heartRateService.streamHeartRate();

        this.rowingData$ = merge(this.webSocketService.data(), this.resetSubject).pipe(
            withLatestFrom(this.heartRateData$),
            map(([rowerDataDto, heartRateData]: [IRowerDataDto, IHeartRate | undefined]): IRowerData => {
                const distance = Math.round(rowerDataDto.distance);
                const rowerData: IRowerData = {
                    bleServiceFlag: rowerDataDto.bleServiceFlag,
                    logLevel: rowerDataDto.logLevel,
                    flywheelInertia: rowerDataDto.flywheelInertia,
                    magicNumber: rowerDataDto.magicNumber,
                    driveDuration: rowerDataDto.driveDuration / 1e6,
                    recoveryDuration: rowerDataDto.recoveryDuration / 1e6,
                    avgStrokePower: rowerDataDto.avgStrokePower,
                    elapsedTime: rowerDataDto.elapsedTime,
                    distance: rowerDataDto.distance - this.activityStartDistance,
                    batteryLevel: rowerDataDto.batteryLevel,
                    dragFactor: rowerDataDto.dragFactor,
                    autoDragFactor: rowerDataDto.autoDragFactor,
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

                this.dataRecorder.add({
                    ...rowerData,
                    heartRate: heartRateData?.contactDetected ? heartRateData : undefined,
                });
                this.dataRecorder.addRaw(rowerDataDto);

                this.lastRevTime = rowerDataDto.revTime;
                this.lastRevCount = distance;
                this.lastStrokeTime = rowerDataDto.strokeTime;
                this.lastStrokeCount = rowerDataDto.strokeCount;
                this.lastDistance = rowerDataDto.distance;
                this.lastElapsedTime = rowerDataDto.elapsedTime;
                this.lastCalories = rowerDataDto.totalCalories;
                this.batteryLevel = rowerDataDto.batteryLevel;
                this.bleServiceFlag = rowerDataDto.bleServiceFlag;
                this.logLevel = rowerDataDto.logLevel;
                this.flywheelInertia = rowerDataDto.flywheelInertia;
                this.magicNumber = rowerDataDto.magicNumber;
                this.autoDragFactor = rowerDataDto.autoDragFactor;
                this.dragFactor = rowerDataDto.dragFactor;

                return rowerData;
            }),
            shareReplay(),
        );
    }

    getAutoDragFactor(): AutoDragFactor {
        return this.autoDragFactor;
    }

    getBleServiceFlag(): BleServiceFlag {
        return this.bleServiceFlag;
    }

    getDragFactor(): number {
        return this.dragFactor;
    }

    getFlywheelInertia(): number {
        return this.flywheelInertia;
    }

    getLogLevel(): LogLevel {
        return this.logLevel;
    }

    getMagicNumber(): number {
        return this.magicNumber;
    }

    heartRateData(): Observable<IHeartRate | undefined> {
        return this.heartRateData$;
    }

    reset(): void {
        this.activityStartDistance = this.lastDistance;
        this.activityStartStrokeCount = this.lastStrokeCount;
        this.dataRecorder.reset();

        this.resetSubject.next({
            driveDuration: 0,
            recoveryDuration: 0,
            avgStrokePower: 0,
            elapsedTime: this.lastElapsedTime,
            distance: this.lastDistance,
            batteryLevel: this.batteryLevel,
            bleServiceFlag: this.bleServiceFlag,
            logLevel: this.logLevel,
            flywheelInertia: this.flywheelInertia,
            magicNumber: this.magicNumber,
            autoDragFactor: this.autoDragFactor,
            dragFactor: this.dragFactor,
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
