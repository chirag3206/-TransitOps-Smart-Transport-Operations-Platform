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

/**
 * Connect to MongoDB Atlas with retry logic
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, MONGO_OPTIONS);
    retries = 0;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB connection error: ${error.message}`);

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
  logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
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
  logger.info('MongoDB connection closed gracefully.');
};

process.on('SIGTERM', () => gracefulClose('SIGTERM'));
process.on('SIGINT', () => gracefulClose('SIGINT'));

module.exports = connectDB;
