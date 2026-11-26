"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WaapiOtpSender_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaapiOtpSender = void 0;
const common_1 = require("@nestjs/common");
let WaapiOtpSender = WaapiOtpSender_1 = class WaapiOtpSender {
    constructor() {
        this.logger = new common_1.Logger(WaapiOtpSender_1.name);
    }
    async send(channel, target, code) {
        const apiKey = process.env.WAAPI_API_KEY ?? process.env.WA_API_KEY;
        const instanceId = process.env.WAAPI_INSTANCE_ID ?? process.env.WA_INSTANCE_ID ?? process.env.WAAPI_ID;
        const baseUrl = process.env.WAAPI_BASE_URL ?? 'https://waapi.app/api/v1';
        const message = `Your Bii Localfinder verification code: ${code}. It expires in 10 minutes.`;
        if (!apiKey) {
            if (process.env.NODE_ENV === 'production') {
                this.logger.error('WAAPI credentials not configured — cannot send verification code.');
                throw new common_1.ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
            }
            this.logger.warn(`[dev only] ${channel} verification code for ${target}: ${code}`);
            return;
        }
        try {
            let res;
            const attempts = [];
            if (instanceId) {
                attempts.push({
                    url: `${baseUrl}/instances/${instanceId}/send-text`,
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: { to: target, message },
                });
                attempts.push({
                    url: `https://waapi.app/api/v1/instances/${instanceId}/messages`,
                    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                    body: { to: target, type: 'text', text: message },
                });
            }
            attempts.push({
                url: `${baseUrl}/send-text`,
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: { to: target, message },
            }, {
                url: `https://waapi.app/api/v1/messages/text`,
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: { to: target, body: message },
            }, {
                url: `https://waapi.app/api/send`,
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: { phone: target, message },
            });
            let lastText = '';
            for (const attempt of attempts) {
                try {
                    res = await fetch(attempt.url, {
                        method: 'POST',
                        headers: attempt.headers,
                        body: JSON.stringify(attempt.body),
                    });
                    if (res.ok)
                        return;
                    lastText = await res.text().catch(() => '');
                    if (res.status !== 404) {
                        this.logger.error(`WAAPI send failed (${res.status}): ${lastText}`);
                        if (process.env.NODE_ENV === 'production') {
                            throw new common_1.ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
                        }
                        return;
                    }
                }
                catch (e) {
                }
            }
            this.logger.error(`WAAPI send failed: ${lastText}`);
            if (process.env.NODE_ENV === 'production') {
                throw new common_1.ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
            }
            return;
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                this.logger.error(`WAAPI send failed (${res.status}): ${text}`);
                if (process.env.NODE_ENV === 'production') {
                    throw new common_1.ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
                }
            }
        }
        catch (err) {
            this.logger.error(`WAAPI request error: ${err.message}`);
            if (process.env.NODE_ENV === 'production') {
                throw new common_1.ServiceUnavailableException('Verification messages cannot sent right now. Please try again later.');
            }
        }
    }
};
exports.WaapiOtpSender = WaapiOtpSender;
exports.WaapiOtpSender = WaapiOtpSender = WaapiOtpSender_1 = __decorate([
    (0, common_1.Injectable)()
], WaapiOtpSender);
//# sourceMappingURL=waapi-otp-sender.js.map