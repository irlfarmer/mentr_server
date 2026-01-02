"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentr';
const DB_NAME = process.env.DB_NAME || 'mentr';
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(MONGODB_URI, {
            dbName: DB_NAME
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.name}`);
    }
    catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('MongoDB Disconnected');
    }
    catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
    }
};
exports.disconnectDB = disconnectDB;
//# sourceMappingURL=database.js.map