"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VerificationModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const notifications_module_1 = require("../notifications/notifications.module");
const files_module_1 = require("../files/files.module");
const verification_constants_1 = require("./verification.constants");
const verification_service_1 = require("./verification.service");
const contact_verification_service_1 = require("./contact-verification.service");
const verification_sweep_processor_1 = require("./verification-sweep.processor");
const otp_sender_1 = require("./otp-sender");
const waapi_otp_sender_1 = require("./waapi-otp-sender");
const verification_controller_1 = require("./verification.controller");
function getOtpSender() {
    if (process.env.WAAPI_API_KEY || process.env.WA_API_KEY) {
        return waapi_otp_sender_1.WaapiOtpSender;
    }
    return otp_sender_1.LoggingOtpSender;
}
let VerificationModule = VerificationModule_1 = class VerificationModule {
    constructor(queue) {
        this.queue = queue;
        this.logger = new common_1.Logger(VerificationModule_1.name);
    }
    async onModuleInit() {
        try {
            await this.queue.upsertJobScheduler('verification-daily-sweep', { pattern: '0 2 * * *' }, { name: 'sweep' });
        }
        catch (err) {
            this.logger.error('Could not schedule the daily verification sweep', err);
        }
    }
};
exports.VerificationModule = VerificationModule;
exports.VerificationModule = VerificationModule = VerificationModule_1 = __decorate([
    (0, common_1.Module)({
        imports: [notifications_module_1.NotificationsModule, files_module_1.FilesModule, bullmq_1.BullModule.registerQueue({ name: verification_constants_1.VERIFICATION_QUEUE })],
        controllers: [verification_controller_1.ProviderVerificationController, verification_controller_1.ContactVerificationController, verification_controller_1.AdminVerificationController],
        providers: [
            verification_service_1.VerificationService,
            contact_verification_service_1.ContactVerificationService,
            verification_sweep_processor_1.VerificationSweepProcessor,
            waapi_otp_sender_1.WaapiOtpSender,
            { provide: otp_sender_1.OTP_SENDER, useClass: getOtpSender() },
        ],
        exports: [verification_service_1.VerificationService],
    }),
    __param(0, (0, bullmq_1.InjectQueue)(verification_constants_1.VERIFICATION_QUEUE)),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], VerificationModule);
//# sourceMappingURL=verification.module.js.map