"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = require("bcrypt");
const prisma = new client_1.PrismaClient();
const PLANS = [
    {
        name: 'Free',
        slug: 'free',
        description: 'Basic AI chat for getting started',
        price: 0,
        interval: 'month',
        sortOrder: 0,
        features: [
            'Basic AI chat',
            'Limited daily requests',
            'Community support',
            'Public projects',
        ],
        limits: {
            dailyRequests: 20,
            weeklyRequests: 100,
            monthlyTokens: 50000,
            monthlyRequests: 200,
            agentMode: false,
            composerMode: false,
        },
    },
    {
        name: 'Pro',
        slug: 'pro',
        description: 'Advanced AI coding for individual developers',
        price: 20,
        interval: 'month',
        sortOrder: 1,
        features: [
            'Agent mode',
            'AI Composer',
            'Autocomplete',
            'Repository indexing',
            'Priority support',
        ],
        limits: {
            dailyRequests: 200,
            weeklyRequests: 1000,
            monthlyTokens: 500000,
            monthlyRequests: 5000,
            agentMode: true,
            composerMode: true,
        },
    },
    {
        name: 'Team',
        slug: 'team',
        description: 'Shared quota and team billing',
        price: 40,
        interval: 'month',
        sortOrder: 2,
        features: [
            'Everything in Pro',
            'Shared team quota',
            'Team members',
            'Admin controls',
            'Team billing',
        ],
        limits: {
            dailyRequests: 500,
            weeklyRequests: 2500,
            monthlyTokens: 1500000,
            monthlyRequests: 15000,
            agentMode: true,
            composerMode: true,
        },
    },
    {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Custom quota and priority routing',
        price: 99,
        interval: 'month',
        sortOrder: 3,
        features: [
            'Custom quota',
            'Priority routing',
            'Dedicated support',
            'Custom deployment support',
            'SLA guarantee',
        ],
        limits: {
            dailyRequests: 2000,
            weeklyRequests: 10000,
            monthlyTokens: 5000000,
            monthlyRequests: 50000,
            agentMode: true,
            composerMode: true,
        },
    },
];
async function main() {
    for (const plan of PLANS) {
        await prisma.plan.upsert({
            where: { slug: plan.slug },
            update: {
                name: plan.name,
                description: plan.description,
                price: plan.price,
                interval: plan.interval,
                features: plan.features,
                limits: plan.limits,
                sortOrder: plan.sortOrder,
                isActive: true,
            },
            create: {
                name: plan.name,
                slug: plan.slug,
                description: plan.description,
                price: plan.price,
                interval: plan.interval,
                features: plan.features,
                limits: plan.limits,
                sortOrder: plan.sortOrder,
                isActive: true,
            },
        });
    }
    console.log('Seeded plans:', PLANS.map((p) => p.slug).join(', '));
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
        const hashed = await bcrypt_1.default.hash(adminPassword, 12);
        const admin = await prisma.user.upsert({
            where: { email: adminEmail },
            update: { role: 'SUPER_ADMIN', password: hashed },
            create: {
                email: adminEmail,
                password: hashed,
                fullName: 'Xander Admin',
                role: 'SUPER_ADMIN',
                emailVerified: true,
            },
        });
        await prisma.userSettings.upsert({
            where: { userId: admin.id },
            update: {},
            create: { userId: admin.id },
        });
        const freePlan = await prisma.plan.findUnique({ where: { slug: 'enterprise' } });
        if (freePlan) {
            const existing = await prisma.subscription.findFirst({ where: { userId: admin.id, status: 'ACTIVE' } });
            if (!existing) {
                await prisma.subscription.create({
                    data: { userId: admin.id, planId: freePlan.id, status: 'ACTIVE' },
                });
            }
        }
        console.log('Seeded admin user:', adminEmail);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map