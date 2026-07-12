/**
 * TransitOps — MongoDB Connection
 * Mongoose connection with retry logic and event listeners
 */
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

const MONGO_OPTIONS = {
  maxPoolSize: 10,        // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 10000, // Keep trying to send operations for 10s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
};

let retries = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds
let mongoServer = null;
let usingMemoryDb = false;

/**
 * Automatically seed the in-memory database if it is empty
 */
const seedIfEmpty = async () => {
  try {
    const User = require('../models/User');
    const count = await User.countDocuments();
    if (count === 0) {
      logger.info('🌱 Empty database detected in In-Memory MongoDB. Seeding demo data...');
      const { seedData, printSummary } = require('../seed/seeder');
      await seedData();
      logger.info('✅ In-Memory database successfully seeded!');
      await printSummary();
    }
  } catch (error) {
    logger.error(`❌ Error auto-seeding In-Memory MongoDB: ${error.message}`);
  }
};

/**
 * Connect to MongoDB with retry logic and In-Memory fallback
 */
const connectDB = async () => {
  const isLocalhostUri = env.MONGODB_URI.includes('localhost') || env.MONGODB_URI.includes('127.0.0.1');
  const isPlaceholderUri = env.MONGODB_URI.includes('<username>') || env.MONGODB_URI.includes('<password>') || env.MONGODB_URI.includes('<cluster>');

  try {
    logger.info(`🔌 Connecting to MongoDB: ${env.MONGODB_URI}...`);
    // If it has placeholder credentials, skip and fail immediately to trigger fallback
    if (isPlaceholderUri) {
      throw new Error('Placeholder database credentials detected.');
    }
    const conn = await mongoose.connect(env.MONGODB_URI, MONGO_OPTIONS);
    retries = 0;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB connection error: ${error.message}`);

    // If it's a localhost/placeholder URI or we are in dev, fall back to memory server immediately
    if (isLocalhostUri || isPlaceholderUri || env.isDev) {
      logger.warn('⚠️  MongoDB connection failed or is unconfigured. Starting in-memory MongoDB Server...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        usingMemoryDb = true;

        logger.info(`💾 In-Memory MongoDB Server started at: ${mongoUri}`);
        const conn = await mongoose.connect(mongoUri, MONGO_OPTIONS);
        logger.info(`✅ Connected to In-Memory MongoDB successfully!`);

        // Check and seed if database is empty
        await seedIfEmpty();

        return conn;
      } catch (memError) {
        logger.error(`💀 Failed to start or connect to In-Memory MongoDB: ${memError.message}`);
        process.exit(1);
      }
    }

    if (retries < MAX_RETRIES) {
      retries++;
      logger.warn(`🔄 Retrying MongoDB connection (${retries}/${MAX_RETRIES}) in ${RETRY_DELAY / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return connectDB();
    }

    logger.error('💀 Max MongoDB retries reached. Exiting...');
    process.exit(1);
  }
};

// Mongoose event listeners
mongoose.connection.on('disconnected', () => {
  if (!usingMemoryDb) {
    logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
  }
});

mongoose.connection.on('reconnected', () => {
  logger.info('✅ MongoDB reconnected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB error: ${err.message}`);
});

// Graceful close on process termination
const gracefulClose = async (signal) => {
  logger.info(`${signal} received. Closing MongoDB connection...`);
  await mongoose.connection.close();
  if (mongoServer) {
    logger.info('Stopping In-Memory MongoDB Server...');
    await mongoServer.stop();
  }
  logger.info('MongoDB connection closed gracefully.');
};

process.on('SIGTERM', () => gracefulClose('SIGTERM'));
process.on('SIGINT', () => gracefulClose('SIGINT'));

module.exports = connectDB;
