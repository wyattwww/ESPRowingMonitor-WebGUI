import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { map, Observable, startWith } from "rxjs";

import { AutoDragFactor, IValidationErrors, LogLevel } from "../../common/common.interfaces";
import { ConfigManagerService } from "../../common/services/config-manager.service";
import { DataService } from "../../common/services/data.service";
import { WebSocketService } from "../../common/services/websocket.service";
import { getValidationErrors } from "../../common/utils/utility.functions";

import { HeartRateMonitorMode } from "./../../common/common.interfaces";

type SettingsFormGroup = FormGroup<{
    websocketAddress: FormControl<string>;
    logLevel: FormControl<LogLevel>;
    flywheelInertia: FormControl<number>;
    autoDragFactor: FormControl<AutoDragFactor>;
    dragFactor: FormControl<number>;
    magicNumber: FormControl<number>;
    heartRateMonitor: FormControl<HeartRateMonitorMode>;
}>;

@Component({
    selector: "app-settings-dialog",
    templateUrl: "./settings-dialog.component.html",
    styleUrls: ["./settings-dialog.component.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
    AutoDragFactor: typeof AutoDragFactor = AutoDragFactor;
    LogLevel: typeof LogLevel = LogLevel;

    isSecureContext: boolean = isSecureContext;

    settingsForm: SettingsFormGroup = this.fb.group({
        websocketAddress: [
            this.configManager.getItem("webSocketAddress"),
            [
                Validators.required,
                Validators.pattern(
                    /^ws:\/\/[a-z0-9-]+(\.?[a-z0-9-])+(:[0-9]+)?([\/?][-a-zA-Z0-9+&@#\/%?=~_]*)?$/,
                ),
            ],
        ],
        logLevel: [this.dataService.getLogLevel(), [Validators.min(0), Validators.max(6)]],
        flywheelInertia: [this.dataService.getFlywheelInertia(), [Validators.min(0), Validators.max(2)]],
        autoDragFactor: [this.dataService.getAutoDragFactor(), [Validators.min(0), Validators.max(1)]],
        dragFactor: [this.dataService.getDragFactor(), [Validators.min(75), Validators.max(250)]],
        magicNumber: [this.dataService.getMagicNumber(), [Validators.min(1), Validators.max(4)]],
        heartRateMonitor: [
            this.configManager.getItem("heartRateMonitor") as HeartRateMonitorMode,
            Validators.pattern(/^(off|ble|ant)$/),
        ],
    });

    settingsFormErrors$: Observable<ValidationErrors | null> = this.settingsForm.statusChanges.pipe(
        startWith("INVALID"),
        map((): IValidationErrors => getValidationErrors(this.settingsForm.controls)),
    );

    constructor(
        private configManager: ConfigManagerService,
        private dataService: DataService,
        private webSocketService: WebSocketService,
        private fb: NonNullableFormBuilder,
        private dialogRef: MatDialogRef<SettingsDialogComponent>,
    ) {}

    submitLoginForm(): void {
        this.configManager.setItem("webSocketAddress", this.settingsForm.value.websocketAddress as string);
        this.configManager.setItem(
            "heartRateMonitor",
            this.settingsForm.value.heartRateMonitor as HeartRateMonitorMode,
        );
        this.webSocketService.changeLogLevel(this.settingsForm.value.logLevel as LogLevel);
        this.webSocketService.changeFlywheelInertia(this.settingsForm.value.flywheelInertia as number);
        this.webSocketService.changeAutoDragFactor(this.settingsForm.value.autoDragFactor as AutoDragFactor);
        this.webSocketService.changeDragFactor(this.settingsForm.value.dragFactor as number);
        this.webSocketService.changeMagicNumber(this.settingsForm.value.magicNumber as number);
        this.dialogRef.close();
    }
}
