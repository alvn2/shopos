const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

// Create a singleton PrismaClient
const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
    ],
});

// Optionally log queries in development
if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
        logger.debug(`Query: ${e.query}`);
        logger.debug(`Params: ${e.params}`);
        logger.debug(`Duration: ${e.duration}ms`);
    });
}

prisma.$on('error', (e) => {
    logger.error('Prisma Error:', e);
});

async function connectDB() {
    try {
        await prisma.$connect();
        logger.info('Successfully connected to Neon PostgreSQL via Prisma');
        return true;
    } catch (error) {
        logger.error('Failed to connect to Neon PostgreSQL:', error);
        return false;
    }
}

async function disconnectDB() {
    await prisma.$disconnect();
    logger.info('Disconnected from Neon PostgreSQL');
}

module.exports = {
    prisma,
    connectDB,
    disconnectDB
};
