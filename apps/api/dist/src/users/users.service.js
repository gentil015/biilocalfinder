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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: true,
                status: true,
                emailVerified: true,
                phoneVerified: true,
                locale: true,
                createdAt: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async updateMe(id, data) {
        const update = {};
        if (data.phone !== undefined)
            update.phone = data.phone.trim() || null;
        if (data.firstName !== undefined)
            update.firstName = data.firstName;
        if (data.lastName !== undefined)
            update.lastName = data.lastName;
        if (data.avatarUrl !== undefined)
            update.avatarUrl = data.avatarUrl;
        if (Object.keys(update).length === 0)
            return this.findById(id);
        if (update.phone) {
            const existing = await this.prisma.user.findFirst({
                where: { phone: update.phone, id: { not: id } },
                select: { id: true },
            });
            if (existing)
                throw new common_1.NotFoundException('Phone number already in use');
        }
        await this.prisma.user.update({ where: { id }, data: update });
        return this.findById(id);
    }
    async updateLocale(id, locale) {
        await this.prisma.user.update({ where: { id }, data: { locale } });
        return this.findById(id);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map